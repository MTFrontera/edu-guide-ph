import { getAuthenticatedUser } from '../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../lib/apiSupabase';

function normalizeRpcError(error) {
  const message = error?.message || 'Dashboard request failed';
  if (
    error?.code === '42501' ||
    /not authorized/i.test(message) ||
    /permission/i.test(message)
  ) {
    return { status: 403, message: 'Staff access is required for this dashboard.' };
  }
  return { status: 500, message };
}

export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : '';

    const { user, error: authError } = await getAuthenticatedUser(request);
    if (!token || !user || authError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseClientWithAuth(token);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (!profile || !['teacher', 'guidance', 'admin'].includes(profile.role)) {
      return Response.json(
        { error: 'Staff access is required for this dashboard.' },
        { status: 403 }
      );
    }

    const [summaryResult, activityResult, usageResult] = await Promise.all([
      supabase.rpc('dashboard_summary'),
      supabase.rpc('dashboard_recent_activity', { p_limit: 12 }),
      supabase.rpc('dashboard_usage_last_7_days'),
    ]);

    const rpcError =
      summaryResult.error || activityResult.error || usageResult.error;

    if (rpcError) {
      const normalized = normalizeRpcError(rpcError);
      return Response.json(
        { error: normalized.message },
        { status: normalized.status }
      );
    }

    return Response.json({
      profile,
      summary: summaryResult.data || {},
      recentActivity: activityResult.data || [],
      usage: usageResult.data || [],
      privacy: {
        messageContentIncluded: false,
        note:
          'This dashboard reports aggregate usage and limited student activity metadata. It does not return chat message contents.',
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return Response.json(
      { error: error.message || 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}
