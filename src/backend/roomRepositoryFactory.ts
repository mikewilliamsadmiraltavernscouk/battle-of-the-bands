import { localRoomRepository, type RoomRepository } from '../roomRepository';
import { getSupabaseConfig } from './supabaseConfig';
import { createSupabaseRoomRepository } from './supabaseRepository';

export function createRoomRepository(): RoomRepository {
  const supabaseConfig = getSupabaseConfig();

  if (!supabaseConfig) {
    return localRoomRepository;
  }

  return createSupabaseRoomRepository(supabaseConfig);
}

export function getRoomRepositoryMode() {
  return getSupabaseConfig() ? 'supabase' : 'local';
}
