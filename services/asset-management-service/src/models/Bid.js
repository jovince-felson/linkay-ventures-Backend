import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database.js';

class Bid extends Model {}

Bid.init(
  {
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    auctionId: {
      type:      DataTypes.UUID,
      allowNull: false,
      field:     'auction_id',
    },
    bidderAddress: {
      type:      DataTypes.STRING(42),
      allowNull: false,
      field:     'bidder_address',
    },
    amount: {
      type:      DataTypes.DECIMAL(20, 6),
      allowNull: false,
    },
    txHash: {
      type:      DataTypes.STRING(66),
      allowNull: true,
      field:     'tx_hash',
    },
  },
  {
    sequelize,
    modelName:   'Bid',
    tableName:   'bids',
    timestamps:  true,
    underscored: true,
    paranoid:    false,
  },
);

export default Bid;
