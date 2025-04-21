import { DataTypes, Model } from 'sequelize';
import sequelize from './database';

// Screenshot model
export class Screenshot extends Model {
  declare id: number;
  declare path: string;
  declare timestamp: Date;
  declare textDescription: string;
  declare metadata: any;
}

Screenshot.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  textDescription: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Screenshot'
});

// Audio Recording model
export class AudioRecording extends Model {
  declare id: number;
  declare path: string;
  declare timestamp: Date;
  declare duration: number;
  declare transcript: string;
  declare metadata: any;
}

AudioRecording.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.FLOAT,
    allowNull: false
  },
  transcript: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'AudioRecording'
});

// Web History model
export class WebHistory extends Model {
  declare id: number;
  declare url: string;
  declare title: string;
  declare timestamp: Date;
  declare duration: number;
  declare metadata: any;
}

WebHistory.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  url: {
    type: DataTypes.STRING,
    allowNull: false
  },
  title: {
    type: DataTypes.STRING,
    allowNull: true
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'WebHistory'
});

// App Usage model
export class AppUsage extends Model {
  declare id: number;
  declare appName: string;
  declare windowTitle: string;
  declare startTime: Date;
  declare endTime: Date;
  declare duration: number;
  declare metadata: any;
}

AppUsage.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  appName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  windowTitle: {
    type: DataTypes.STRING,
    allowNull: true
  },
  startTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endTime: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'AppUsage'
});

// AI Insight model
export class AIInsight extends Model {
  declare id: number;
  declare content: string;
  declare timestamp: Date;
  declare type: string;
  declare metadata: any;
}

AIInsight.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'AIInsight'
});

// Settings model
export class Settings extends Model {
  declare id: number;
  declare key: string;
  declare value: any;
}

Settings.init({
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  value: {
    type: DataTypes.JSON,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Settings'
});

// Export all models
export const models = {
  Screenshot,
  AudioRecording,
  WebHistory,
  AppUsage,
  AIInsight,
  Settings
};
