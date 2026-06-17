import sequelize                               from '../config/database.js';
import { auctionQueue }                        from '../config/queue.js';
import { getFractionalToken, getAuctionHouse } from '../blockchain/contracts.js';

const MOCK = process.env.CONTRACTS_ENABLED !== 'true';

console.log('⚙️  Auction worker booted');

auctionQueue.process('startAuction', async (job) => {
  const { auctionId, assetId, fractionsAllocated, reservePrice, minIncrement, startTs, endTs } = job.data;

  console.log(`🏁 startAuction fired — DB auction ${auctionId}`);

  const [[asset]] = await sequelize.query(
    'SELECT erc3643_contract_address FROM assets WHERE id = ?',
    { replacements: [assetId] },
  );
  if (!asset?.erc3643_contract_address) {
    throw new Error(`No fractional token address for asset ${assetId}`);
  }

  const tokenContract = asset.erc3643_contract_address;
  const toUsdc = (val) => BigInt(Math.round(Number(val) * 1e6));
  const amount         = BigInt(fractionsAllocated);
  const reserveWei     = toUsdc(reservePrice);
  const incrementWei   = toUsdc(minIncrement);
  const paymentToken   = process.env.USDC_ADDRESS || '0x0000000000000000000000000000000000000000';
  const now            = Math.floor(Date.now() / 1000);
  const onChainStartTs = BigInt(now + 120);
  const duration       = Math.max(3600, Number(endTs) - Number(startTs));
  const onChainEndTs   = BigInt(now + 120 + duration);

  let onChainAuctionId;

  if (!MOCK) {
    const token       = getFractionalToken(tokenContract);
    const houseAddr   = process.env.AUCTION_HOUSE_ADDRESS;
    const treasury    = process.env.TREASURY_WALLET;
    const allowance   = await token.allowance(treasury, houseAddr);

    if (allowance < amount) {
      const approveTx = await token.approve(houseAddr, amount);
      await approveTx.wait(1, 120000);
      console.log(`✅ Re-approved ${amount.toString()} tokens for AuctionHouse`);
    }

    const house   = getAuctionHouse();
    const tx      = await house.createAuction(
      tokenContract,
      amount,
      reserveWei,
      incrementWei,
      onChainStartTs,
      onChainEndTs,
      paymentToken,
    );
    const receipt = await tx.wait(1, 120000);

    const event = receipt.logs
      .map((log) => { try { return house.interface.parseLog(log); } catch { return null; } })
      .find((e) => e?.name === 'AuctionCreated');

    onChainAuctionId = event ? event.args.auctionId.toString() : null;
    console.log(`✅ createAuction() onChainId=${onChainAuctionId} tx=${receipt.hash}`);
  } else {
    onChainAuctionId = String(Math.floor(Math.random() * 100000));
    console.log(`🔧 MOCK createAuction fakeId=${onChainAuctionId}`);
  }

  const [[auctionRow]] = await sequelize.query(
    'SELECT timezone FROM auctions WHERE id = ?',
    { replacements: [auctionId] },
  );
  const tz = auctionRow?.timezone || 'UTC';
  const tzOffsetMin = (() => {
    if (!tz || tz === 'UTC') return 0;
    const m = tz.match(/^UTC([+-])(\d{1,2})(?::(\d{2}))?$/i);
    if (m) {
      const sign = m[1] === '+' ? 1 : -1;
      return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? '0', 10));
    }
    return 0;
  })();
  const localEndMs = Number(onChainEndTs) * 1000 + tzOffsetMin * 60 * 1000;
  const localEndDate = new Date(localEndMs);
  const endDate = localEndDate.toISOString().slice(0, 10);
  const endTime = localEndDate.toISOString().slice(11, 16);

  await sequelize.query(
    'UPDATE auctions SET status = ?, onchain_auction_id = ?, end_date = ?, end_time = ?, updated_at = NOW() WHERE id = ?',
    { replacements: ['LIVE', onChainAuctionId, endDate, endTime, auctionId] },
  );

  // Reschedule settle job using the actual on-chain end time
  const settleJobId  = `settle-${auctionId}`;
  const oldSettle    = await auctionQueue.getJob(settleJobId);
  if (oldSettle) await oldSettle.remove();

  const onChainEndMs  = Number(onChainEndTs) * 1000;
  const settleDelayMs = Math.max(0, onChainEndMs - Date.now());
  await auctionQueue.add('settleAuction', { auctionId }, {
    delay:  settleDelayMs,
    jobId:  settleJobId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  });
  console.log(`⏰ Settle rescheduled in ${Math.round(settleDelayMs / 1000)}s (on-chain endTs=${onChainEndTs})`);

  console.log(`🎉 Auction ${auctionId} → LIVE (onChainId=${onChainAuctionId})`);
});

auctionQueue.process('settleAuction', async (job) => {
  const { auctionId } = job.data;

  console.log(`🔔 settleAuction fired — DB auction ${auctionId}`);

  const [[auction]] = await sequelize.query(
    'SELECT onchain_auction_id, status FROM auctions WHERE id = ?',
    { replacements: [auctionId] },
  );

  if (!auction) throw new Error(`Auction ${auctionId} not found`);

  if (auction.status === 'CANCELLED') {
    console.log(`⚠️  Auction ${auctionId} was cancelled — skipping settlement`);
    return;
  }
  if (auction.status === 'ENDED') {
    console.log(`ℹ️  Auction ${auctionId} already ENDED`);
    return;
  }

  let winnerAddress    = null;
  let winningBid       = null;
  let settlementStatus = null;

  if (!MOCK) {
    const onChainId = auction.onchain_auction_id;
    if (!onChainId) throw new Error(`Missing onchain_auction_id for auction ${auctionId}`);

    const house   = getAuctionHouse();
    const tx      = await house.settleAuction(BigInt(onChainId));
    const receipt = await tx.wait(1, 120000);
    console.log(`✅ settleAuction(${onChainId}) tx=${receipt.hash}`);

    for (const log of receipt.logs) {
      let parsed;
      try { parsed = house.interface.parseLog(log); } catch { continue; }

      if (parsed?.name === 'AuctionSettled') {
        winnerAddress    = parsed.args.winner;
        winningBid       = (Number(parsed.args.winningBid) / 1e6).toFixed(6);
        settlementStatus = 'SETTLED';
        console.log(`🏆 AuctionSettled winner=${winnerAddress} bid=${winningBid} USDC`);
      } else if (parsed?.name === 'ReserveNotMet') {
        settlementStatus = 'RESERVE_NOT_MET';
        console.log(`⚠️  ReserveNotMet — highest bid ${Number(parsed.args.highestBid) / 1e6} < reserve ${Number(parsed.args.reservePrice) / 1e6} USDC`);
      }
    }
  } else {
    console.log(`🔧 MOCK settleAuction`);
    // In mock mode simulate a settled auction with a dummy winner
    settlementStatus = 'SETTLED';
  }

  await sequelize.query(
    `UPDATE auctions
        SET status = ?, settlement_status = ?, winner_address = ?, winning_bid = ?, updated_at = NOW()
      WHERE id = ?`,
    { replacements: ['ENDED', settlementStatus, winnerAddress, winningBid, auctionId] },
  );

  console.log(`✅ Auction ${auctionId} → ENDED (settlement=${settlementStatus})`);
});

auctionQueue.on('failed', (job, err) => {
  console.error(`❌ Auction job ${job.id} (${job.name}) failed:`, err.message);
});
