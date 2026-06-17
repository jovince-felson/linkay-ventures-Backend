import sequelize          from '../config/database.js';
import Asset              from './Asset.js';
import AssetOwnership     from './AssetOwnership.js';
import AssetTokenization  from './AssetTokenization.js';
import AssetMedia         from './AssetMedia.js';
import Auction            from './Auction.js';
import Bid                from './Bid.js';

// ── Associations ────────────────────────────────────────────────────────────────

Asset.hasMany(AssetOwnership, { foreignKey: 'assetId', as: 'ownershipSplit', onDelete: 'CASCADE' });
AssetOwnership.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Asset.hasOne(AssetTokenization, { foreignKey: 'assetId', as: 'tokenization', onDelete: 'CASCADE' });
AssetTokenization.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Asset.hasMany(AssetMedia, { foreignKey: 'assetId', as: 'mediaItems', onDelete: 'CASCADE' });
AssetMedia.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Asset.hasMany(Auction, { foreignKey: 'assetId', as: 'auctions', onDelete: 'CASCADE' });
Auction.belongsTo(Asset, { foreignKey: 'assetId', as: 'asset' });

Auction.hasMany(Bid, { foreignKey: 'auctionId', as: 'bids', onDelete: 'CASCADE' });
Bid.belongsTo(Auction, { foreignKey: 'auctionId', as: 'auction' });

export { sequelize, Asset, AssetOwnership, AssetTokenization, AssetMedia, Auction, Bid };
