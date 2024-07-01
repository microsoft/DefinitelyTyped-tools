// Generated from the JSON response because it's not in the upstream tooling

export interface DiscussionWebhook {
  action: string;
  discussion: Discussion;
  repository: any;
  sender: any;
}

export interface Discussion {
  repository_url: string;
  category: Category;
  answer_html_url: null;
  answer_chosen_at: null;
  answer_chosen_by: null;
  html_url: string;
  id: number;
  node_id: string;
  number: number;
  title: string;
  user: Sender;
  state: string;
  locked: boolean;
  comments: number;
  created_at: Date;
  updated_at: Date;
  author_association: string;
  active_lock_reason: null;
  body: string;
}

export interface Category {
  id: number;
  repository_id: number;
  emoji: string;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  slug: string;
  is_answerable: boolean;
}
