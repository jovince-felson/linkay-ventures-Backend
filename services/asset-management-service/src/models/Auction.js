import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Auction extends Model {}

Auction.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    assetId: {
      type:      DataTypes.UUID,
      allowNull: false,
      field:     'asset_id',
    },
    museumId: {
      type:      DataTypes.STRING(36),
      allowNull: false,
      field:     'museum_id',
    },
    createdBy: {
      type:      DataTypes.STRING(36),
      allowNull: false,
      field:     'created_by',
    },
    updatedBy: {
      type:      DataTypes.STRING(36),
      allowNull: true,
      field:     'updated_by',
    },

    // Auction Info
    title: {
      type:      DataTypes.STRING(500),
      allowNull: false,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },

    // Supply & Pricing
    fractionsAllocated: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field:     'fractions_allocated',
    },
    minPurchaseQty: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field:     'min_purchase_qty',
    },
    maxPurchaseQty: {
      type:      DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      field:     'max_purchase_qty',
    },
    startingBidPrice: {
      type:      DataTypes.DECIMAL(20, 2),
      allowNull: false,
      field:     'starting_bid_price',
    },
    reservePrice: {
      type:      DataTypes.DECIMAL(20, 2),
      allowNull: false,
      field:     'reserve_price',
    },
    minIncrement: {
      type:      DataTypes.DECIMAL(20, 2),
      allowNull: false,
      field:     'min_increment',
    },

    // Schedule
    startDate: {
      type:      DataTypes.DATEONLY,
      allowNull: false,
      field:     'start_date',
    },
    startTime: {
      type:      DataTypes.STRING(8),
      allowNull: false,
      field:     'start_time',
    },
    endDate: {
      type:      DataTypes.DATEONLY,
      allowNull: false,
      field:     'end_date',
    },
    endTime: {
      type:      DataTypes.STRING(8),
      allowNull: false,
      field:     'end_time',
    },
    timezone: {
      type:         DataTypes.STRING(20),
      allowNull:    false,
      defaultValue: 'UTC',
    },
    showCountdown: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
      field:        'show_countdown',
    },

    // Status
    status: {
      type:         DataTypes.ENUM('DRAFT', 'SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED'),
      defaultValue: 'SCHEDULED',
      allowNull:    false,
    },
    onChainAuctionId: {
      type:      DataTypes.STRING(78),
      allowNull: true,
      field:     'onchain_auction_id',
    },
  },
  {
    sequelize,
    modelName:   'Auction',
    tableName:   'auctions',
    paranoid:    true,
    timestamps:  true,
    underscored: true,
  },
);

export default Auction;
