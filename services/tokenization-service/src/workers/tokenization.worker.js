import { tokenizationQueue }    from '../config/queue.js';
import TokenizationJob          from '../models/TokenizationJob.js';
import Asset                    from '../models/Asset.js';
import sequelize                from '../config/database.js';
import { ipfsStep }             from '../steps/ipfs.step.js';
import { mintNFTStep }          from '../steps/mintNFT.step.js';
import { deployFractionalStep } from '../steps/deployFractional.step.js';
import { setComplianceStep }    from '../steps/setCompliance.step.js';

console.log('⚙️  Tokenization worker booted');

tokenizationQueue.process(async (bullJob) => {
  const payload = bullJob.data;
  const { jobId } = payload;

  const job = await TokenizationJob.findByPk(jobId);
  if (!job) throw new Error(`TokenizationJob ${jobId} not found`);

  await job.update({ status: 'processing' });

  const steps = job.steps || {};

  // ── Step 6: IPFS ──────────────────────────────────────────────────────────
  let ipfsResult;
  if (steps.ipfs?.status === 'completed') {
    // Resume: reuse stored result from previous run
    ipfsResult = { cid: steps.ipfs.cid, uri: steps.ipfs.uri };
    console.log(`⏭️  Skipping IPFS step for job ${jobId} — already completed`);
  } else {
    try {
      await job.updateStep('ipfs', { status: 'processing' });
      ipfsResult = await ipfsStep(payload);
      await job.updateStep('ipfs', {
        status:      'completed',
        cid:         ipfsResult.cid,
        uri:         ipfsResult.uri,
        completedAt: new Date(),
      });
    } catch (err) {
      await job.updateStep('ipfs', { status: 'failed', error: err.message });
      await job.update({ status: 'failed', errorMessage: `IPFS failed: ${err.message}` });
      return;
    }
  }

  // ── Step 7: Mint NFT ──────────────────────────────────────────────────────
  let nftResult;
  if (steps.mintNFT?.status === 'completed') {
    nftResult = {
      txHash:           steps.mintNFT.txHash,
      nftContractAddress: steps.mintNFT.contractAddress,
      tokenId:          steps.mintNFT.tokenId,
    };
    console.log(`⏭️  Skipping mintNFT step for job ${jobId} — already completed`);
  } else {
    try {
      await job.updateStep('mintNFT', { status: 'processing' });
      nftResult = await mintNFTStep({ ...payload, ipfsUri: ipfsResult.uri });
      await job.updateStep('mintNFT', {
        status:          'completed',
        txHash:          nftResult.txHash,
        contractAddress: nftResult.nftContractAddress,
        tokenId:         nftResult.tokenId,
        completedAt:     new Date(),
      });
    } catch (err) {
      await job.updateStep('mintNFT', { status: 'failed', error: err.message });
      await job.update({ status: 'failed', errorMessage: `mintNFT failed: ${err.message}` });
      return;
    }
  }

  // ── Steps 8+9: Deploy Fractional Token + Mint Fractions ──────────────────
  let fractionalResult;
  if (steps.deployToken?.status === 'completed' && steps.mintFractions?.status === 'completed') {
    fractionalResult = {
      txHash:               steps.deployToken.txHash,
      tokenContractAddress: steps.deployToken.contractAddress,
      totalSupply:          steps.mintFractions.totalSupply,
    };
    console.log(`⏭️  Skipping deployFractional step for job ${jobId} — already completed`);
  } else {
    try {
      await job.updateStep('deployToken',   { status: 'processing' });
      await job.updateStep('mintFractions', { status: 'processing' });
      fractionalResult = await deployFractionalStep(payload);
      const now = new Date();
      await job.updateStep('deployToken', {
        status:          'completed',
        txHash:          fractionalResult.txHash,
        contractAddress: fractionalResult.tokenContractAddress,
        completedAt:     now,
      });
      await job.updateStep('mintFractions', {
        status:      'completed',
        txHash:      fractionalResult.txHash,
        totalSupply: fractionalResult.totalSupply,
        completedAt: now,
      });
    } catch (err) {
      await job.updateStep('deployToken',   { status: 'failed', error: err.message });
      await job.updateStep('mintFractions', { status: 'failed', error: err.message });
      await job.update({ status: 'failed', errorMessage: `deployFractional failed: ${err.message}` });
      return;
    }
  }

  // ── Step 10: Set Compliance Rules ─────────────────────────────────────────
  if (steps.setCompliance?.status === 'completed') {
    console.log(`⏭️  Skipping setCompliance step for job ${jobId} — already completed`);
  } else {
    try {
      await job.updateStep('setCompliance', { status: 'processing' });
      const complianceResult = await setComplianceStep(payload);
      await job.updateStep('setCompliance', {
        status:      'completed',
        txHash:      complianceResult.txHash,
        completedAt: new Date(),
      });
    } catch (err) {
      await job.updateStep('setCompliance', { status: 'failed', error: err.message });
      await job.update({ status: 'failed', errorMessage: `setCompliance failed: ${err.message}` });
      return;
    }
  }

  // ── All steps done ────────────────────────────────────────────────────────
  await job.update({ status: 'completed', completedAt: new Date() });

  // Mark as TREASURY_PENDING — awaiting platform treasury approval before auction
  await sequelize.query(
    'UPDATE asset_tokenizations SET tokenization_status = ? WHERE asset_id = ?',
    { replacements: ['TREASURY_PENDING', payload.assetId] },
  );

  console.log(`✅ Tokenization completed for asset ${payload.assetId} — awaiting treasury approval`);
});

tokenizationQueue.on('failed', (bullJob, err) => {
  console.error(`❌ Bull job ${bullJob.id} failed:`, err.message);
});
