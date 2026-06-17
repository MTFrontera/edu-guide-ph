import { getAuthenticatedUser } from '../../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../../lib/apiSupabase';

async function getAuthenticatedSupabase(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.slice('Bearer '.length).trim();
  const { user, error } = await getAuthenticatedUser(request);

  if (!token || !user || error) {
    return { user: null, supabase: null, error: error || 'Unauthorized' };
  }

  const supabase = createSupabaseClientWithAuth(token);
  return { user, supabase, error: null };
}

async function ensureUserProfile(supabase, user) {
  const profileEmail = user.email || `${user.id}@local.invalid`;
  const { error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        email: profileEmail
      },
      { onConflict: 'id' }
    );

  if (error) throw error;
}

// GET: Fetch messages for a specific session
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedSupabase(request);
    if (authError || !user || !supabase) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return Response.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return Response.json({ messages: messages || [] });
  } catch (error) {
    console.error('Get messages error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST: Save a new message to a session
export async function POST(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedSupabase(request);
    if (authError || !user || !supabase) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { sessionId, role, content } = await request.json();

    if (!sessionId || !role || !content) {
      return Response.json(
        { error: 'Session ID, Role, and Content are required' },
        { status: 400 }
      );
    }

    await ensureUserProfile(supabase, user);

    const { data: ownedSession, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (sessionError) throw sessionError;
    if (!ownedSession) {
      return Response.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const { data: message, error } = await supabase
      .from('chat_messages')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        role,
        content
      })
      .select()
      .single();

    if (error) throw error;

    // Update the session's updated_at timestamp
    await supabase
      .from('chat_sessions')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', sessionId);

    return Response.json({ message });
  } catch (error) {
    console.error('Save message error:', error);
    return Response.json(
      { error: error.message || 'Failed to save message' },
      { status: 500 }
    );
  }
}
