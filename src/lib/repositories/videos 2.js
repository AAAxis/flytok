import { base44 } from '@/api/base44Client';

const E = base44.entities.Video;

export const videos = {
  list: (sort, limit) => E.list(sort, limit),
  filter: (query, sort, limit) => E.filter(query, sort, limit),
  get: (id) => E.get(id),
  create: (data) => E.create(data),
  update: (id, data) => E.update(id, data),
  delete: (id) => E.delete(id),
};
