import { actor } from "actor-core";

// State of a single cursor
export interface CursorState {
  color: string;  // Cursor color (HSL)
  name?: string;  // Display name
  x: number;      // X position
  y: number;      // Y position
}

// Room state with all cursors
interface State {
  cursors: Record<string, CursorState>;  // Map of connection ID → cursor
}

// Cursor room actor - tracks and broadcasts cursor positions
export const cursorRoom = actor({
  // Initial empty state
  state: {
    cursors: {},
  } as State,

  actions: {
    // Get all active cursors
    async getCursors(c) {
      console.log('getCursors - Current connections:', Array.from(c.conns.keys()));
      console.log('getCursors - Current cursors:', Object.keys(c.state.cursors));
      return c.state.cursors;
    },

    // Update cursor position
    async updateCursor(c, x: number, y: number) {
      const id = c.conn.id;
      console.log('updateCursor - Using connection:', id);

      // Update position, keep other properties
      c.state.cursors[id] = {
        ...c.state.cursors[id],
        x,
        y,
      };

      console.log('updateCursor - Cursor state:', c.state.cursors[id]);
      // Broadcast to all clients
      c.broadcast("cursorMoved", {
        id,
        cursor: c.state.cursors[id],
      });
    },

    // Set cursor name
    async setName(c, name: string) {
      const id = c.conn.id;
      console.log('setName - Using connection:', id, name);
      
      const cursor = c.state.cursors[id];
      if (cursor) {
        cursor.name = name;
        c.broadcast("cursorMoved", { id, cursor });
      } else {
        console.error('setName - Cursor not found for connection:', id);
      }
    },

    // Set cursor color
    async setColor(c, color: string) {
      const id = c.conn.id;
      console.log('setColor - Using connection:', id);
      
      const cursor = c.state.cursors[id];
      if (cursor) {
        cursor.color = color;
        c.broadcast("cursorMoved", { id, cursor });
      } else {
        console.error('setColor - Cursor not found for connection:', id);
      }
    },
  },

  // New client connects - create cursor with random color
  onConnect(c, conn) {
    const id = conn.id;
    console.log('onConnect - All connections:', Array.from(c.conns.keys()));
    console.log('onConnect - Using connection:', id);
    
    // Create cursor with random color
    c.state.cursors[id] = {
      color: `hsl(${Math.random() * 360}, 70%, 50%)`,
      x: 0,
      y: 0,
    };
    console.log('onConnect - Created cursor:', c.state.cursors[id]);
  },

  // Client disconnects - remove cursor and notify others
  onDisconnect(c, conn) {
    const id = conn.id;
    console.log('onDisconnect - Connection disconnected:', id);
    
    // Remove cursor
    delete c.state.cursors[id];
    
    // Notify others
    c.broadcast("cursorRemoved", id);
  },
});