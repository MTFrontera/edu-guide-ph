import { getAuthenticatedUser } from '../../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../../lib/apiSupabase';

// Helper function to get authenticated Supabase client
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

// GET: Fetch all chat sessions for the user
export async function GET(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedSupabase(request);
    if (authError || !user || !supabase) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { data: sessions, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return Response.json({ sessions: sessions || [] });
  } catch (error) {
    console.error('Get sessions error:', error);
    return Response.json(
      { error: error.message || 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

// POST: Create a new chat session
export async function POST(request) {
  try {
    const { user, supabase, error: authError } = await getAuthenticatedSupabase(request);
    if (authError || !user || !supabase) {
      return Response.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { title, updateId } = await request.json();
    await ensureUserProfile(supabase, user);

    let session = null;
    let error = null;

    if (updateId) {
      const result = await supabase
        .from('chat_sessions')
        .update({ title: title || 'New Chat' })
        .eq('id', updateId)
        .eq('user_id', user.id)
        .select()
        .single();
      session = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('chat_sessions')
        .insert({
          user_id: user.id,
          title: title || 'New Chat'
        })
        .select()
        .single();
      session = result.data;
      error = result.error;
    }

    if (error) throw error;

    return Response.json({ session });
  } catch (error) {
    console.error('Create session error:', error);
    return Response.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}

// DELETE: Delete a chat session
export async function DELETE(request) {
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

    const { error } = await supabase
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', user.id);

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete session error:', error);
    return Response.json(
      { error: error.message || 'Failed to delete session' },
      { status: 500 }
    );
  }
}
