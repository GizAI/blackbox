import { Sequelize } from 'sequelize';
import * as path from 'path';
import { app } from 'electron';
import fs from 'fs';

// Define database path in user data directory
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'blackbox.sqlite');

// Create Sequelize instance
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: dbPath,
  logging: false // Set to console.log for debugging
});

// Initialize database
export async function initDatabase() {
  try {
    // Ensure the directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
    
    // Test the connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('All models were synchronized successfully.');
    
    return true;
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    return false;
  }
}

// Export sequelize instance
export default sequelize;
