-- =============================================================================
-- Conversation history for the AI Assistant (mcp-server/ tools
-- add_conversation_summary and get_recent_conversations).
--
-- One row per stored conversation summary, keyed by the user it belongs to
-- (any stable identifier the client passes, e.g. the login email). Lives in its
-- own schema because schema.sql drops and recreates cost_granularity, which
-- would wipe the history on every data reload.
--
-- The MCP server writes with cg_mcp_history, which can only SELECT and INSERT
-- this one table (append-only), so cg_mcp_readonly stays strictly read-only.
-- Set a password for non-local use: ALTER ROLE cg_mcp_history PASSWORD '...';
--
-- Idempotent: safe to re-run; never drops stored history.
--   psql -d cost_granularity -v ON_ERROR_STOP=1 -f conversation_history.sql
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS assistant;
COMMENT ON SCHEMA assistant IS 'AI Assistant state (conversation history); kept separate from the reloadable business data.';

CREATE TABLE IF NOT EXISTS assistant.conversation_history (
    id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     text        NOT NULL CHECK (btrim(user_id) <> ''),
    summary     text        NOT NULL CHECK (btrim(summary) <> ''),
    created_at  timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE  assistant.conversation_history IS 'One stored summary per conversation with an AI Assistant user.';
COMMENT ON COLUMN assistant.conversation_history.user_id IS 'Who the conversation was with, as passed by the client (e.g. login email). Matched case-insensitively.';

-- Serves "most recent N summaries for a user" without a sort.
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_created
    ON assistant.conversation_history (lower(user_id), created_at DESC, id DESC);

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'cg_mcp_history') THEN
        CREATE ROLE cg_mcp_history LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END $$;
ALTER ROLE cg_mcp_history SET statement_timeout = '15s';
ALTER ROLE cg_mcp_history SET search_path = assistant;
REVOKE CREATE ON SCHEMA public FROM cg_mcp_history;
GRANT USAGE          ON SCHEMA assistant TO cg_mcp_history;
GRANT SELECT, INSERT ON assistant.conversation_history TO cg_mcp_history;

COMMIT;
