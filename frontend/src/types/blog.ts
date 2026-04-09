export type BlogStatus = 'draft' | 'published';

export interface BlogPost {
  id: string;
  _id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content?: string;
  category?: string;
  coverImage?: string;
  author?: string;
  readTime?: number;
  status?: BlogStatus;
  publishedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
