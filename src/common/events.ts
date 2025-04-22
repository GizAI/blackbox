// Common event handling

import { ipcMain, ipcRenderer } from 'electron';
import { EVENTS } from './constants';

// Event emitter for main process
class MainProcessEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  // Add event listener
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(listener);
  }

  // Remove event listener
  off(event: string, listener: Function): void {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
  }

  // Emit event
  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    for (const listener of eventListeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  // Remove all listeners for an event
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Event emitter for renderer process
class RendererProcessEventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  // Add event listener
  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
      
      // Register with ipcRenderer
      ipcRenderer.on(event, (_event, ...args) => {
        this.emit(event, ...args);
      });
    }
    this.listeners.get(event)?.push(listener);
  }

  // Remove event listener
  off(event: string, listener: Function): void {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    const index = eventListeners.indexOf(listener);
    if (index !== -1) {
      eventListeners.splice(index, 1);
    }
    
    // If no more listeners, remove ipcRenderer listener
    if (eventListeners.length === 0) {
      ipcRenderer.removeAllListeners(event);
      this.listeners.delete(event);
    }
  }

  // Emit event
  emit(event: string, ...args: any[]): void {
    if (!this.listeners.has(event)) return;
    
    const eventListeners = this.listeners.get(event);
    if (!eventListeners) return;
    
    for (const listener of eventListeners) {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    }
  }

  // Send event to main process
  send(event: string, ...args: any[]): void {
    ipcRenderer.send(event, ...args);
  }

  // Remove all listeners for an event
  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
      ipcRenderer.removeAllListeners(event);
    } else {
      for (const event of this.listeners.keys()) {
        ipcRenderer.removeAllListeners(event);
      }
      this.listeners.clear();
    }
  }
}

// Create event emitters
const mainEvents = new MainProcessEventEmitter();
const rendererEvents = new RendererProcessEventEmitter();

// Set up IPC event bridge for main process
export function setupMainProcessEvents(): void {
  // Forward events from renderer to main process event emitter
  Object.values(EVENTS).forEach(category => {
    Object.values(category).forEach(event => {
      ipcMain.on(event, (_ipcEvent, ...args) => {
        mainEvents.emit(event, ...args);
      });
    });
  });
}

// Export appropriate event emitter based on process type
export default (process.type === 'renderer') ? rendererEvents : mainEvents;
