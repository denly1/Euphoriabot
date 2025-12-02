const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:8000';

export interface Poster {
  id: number;
  file_id: string;
  caption?: string;
  ticket_url?: string;
  venue_map_file_id?: string;
  created_at: string;
  is_active: boolean;
}

export interface Story {
  id: number;
  file_id: string;
  caption?: string;
  order_num: number;
  created_at: string;
  is_active: boolean;
}

export async function getPosters(): Promise<Poster[]> {
  try {
    const response = await fetch(`${API_URL}/posters`);
    if (!response.ok) throw new Error('Failed to fetch posters');
    return await response.json();
  } catch (error) {
    console.error('Error fetching posters:', error);
    return [];
  }
}

export async function getStories(): Promise<Story[]> {
  try {
    const response = await fetch(`${API_URL}/stories`);
    if (!response.ok) throw new Error('Failed to fetch stories');
    return await response.json();
  } catch (error) {
    console.error('Error fetching stories:', error);
    return [];
  }
}

export async function getHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error('API is down');
    return await response.json();
  } catch (error) {
    console.error('Error checking API health:', error);
    return { status: 'error' };
  }
}

export async function checkAdmin(userId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/check-admin/${userId}`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.is_admin;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function createStory(userId: number, fileId: string, caption?: string, orderNum: number = 0): Promise<Story | null> {
  try {
    const response = await fetch(`${API_URL}/stories?user_id=${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId, caption, order_num: orderNum })
    });
    if (!response.ok) throw new Error('Failed to create story');
    return await response.json();
  } catch (error) {
    console.error('Error creating story:', error);
    return null;
  }
}

export async function updateStory(userId: number, storyId: number, updates: { caption?: string; order_num?: number; is_active?: boolean }): Promise<Story | null> {
  try {
    const response = await fetch(`${API_URL}/stories/${storyId}?user_id=${userId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!response.ok) throw new Error('Failed to update story');
    return await response.json();
  } catch (error) {
    console.error('Error updating story:', error);
    return null;
  }
}

export async function deleteStory(userId: number, storyId: number): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/stories/${storyId}?user_id=${userId}`, {
      method: 'DELETE'
    });
    return response.ok;
  } catch (error) {
    console.error('Error deleting story:', error);
    return false;
  }
}

export const api = {
  getPosters,
  getStories,
  getHealth,
  checkAdmin,
  createStory,
  updateStory,
  deleteStory
};

export default api;
