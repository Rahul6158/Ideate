# Completed Tasks

- [x] Move the reply and options in chat to the bottom beside the reactions button.
- [x] Fix reactions visibility across accounts: updated Supabase RLS policies on `post_reactions`, enabled realtime sync on `post_reactions` changes in `DiscussionView`, and synchronized `post.reactions` in `PostItem`.
- [x] Profile menu opens directly below the account menu / pill, floating cleanly over chat headers with proper z-index.
- [x] Auto-clear notifications after 1 hour once marked as viewed/read (both in-app cache and database).