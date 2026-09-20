import { getAuthenticatedUser } from '../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../lib/apiSupabase';

function normalizeRpcError(error) {
  const message = error?.message || 'Dashboard request failed';
  if (
    error?.code === '42501' ||
    /not authorized/i.test(message) ||
    /admin access/i.test(message) ||
    /permission/i.test(message)
  ) {
    return { status: 403, message };
  }
  return { status: 500, message };
}

async function getAuthorizedContext(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!token || !user || authError) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const supabase = createSupabaseClientWithAuth(token);
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name, role, account_type, school_id')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    return {
      error: Response.json(
        { error: profileError.message || 'Could not load staff profile.' },
        { status: 500 }
      ),
    };
  }

  if (!profile || !['teacher', 'guidance', 'admin'].includes(profile.role)) {
    return {
      error: Response.json(
        { error: 'Staff access is required for this dashboard.' },
        { status: 403 }
      ),
    };
  }

  return { supabase, profile, user };
}

export async function GET(request) {
  try {
    const context = await getAuthorizedContext(request);
    if (context.error) return context.error;

    const { supabase, profile } = context;

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

    let teacherVerifications = [];

    if (profile.role === 'admin') {
      const queueResult = await supabase.rpc('admin_teacher_verification_queue');

      if (queueResult.error) {
        const normalized = normalizeRpcError(queueResult.error);
        return Response.json(
          { error: normalized.message },
          { status: normalized.status }
        );
      }

      teacherVerifications = await Promise.all(
        (queueResult.data || []).map(async (item) => {
          const { data: signedData } = await supabase.storage
            .from('teacher-verifications')
            .createSignedUrl(item.document_path, 600);

          return {
            ...item,
            documentUrl: signedData?.signedUrl || null,
          };
        })
      );
    }

    return Response.json({
      profile,
      summary: summaryResult.data || {},
      recentActivity: activityResult.data || [],
      usage: usageResult.data || [],
      teacherVerifications,
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

export async function POST(request) {
  try {
    const context = await getAuthorizedContext(request);
    if (context.error) return context.error;

    const { supabase, profile } = context;

    if (profile.role !== 'admin') {
      return Response.json(
        { error: 'Admin access is required to review teacher accounts.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const requestId = String(body?.requestId || '').trim();
    const decision = String(body?.decision || '').trim();
    const notes = String(body?.notes || '').trim();

    if (!requestId || !['approved', 'rejected'].includes(decision)) {
      return Response.json(
        { error: 'A valid request and decision are required.' },
        { status: 400 }
      );
    }

    const result = await supabase.rpc('admin_review_teacher_verification', {
      p_request_id: requestId,
      p_decision: decision,
      p_notes: notes || null,
    });

    if (result.error) {
      const normalized = normalizeRpcError(result.error);
      return Response.json(
        { error: normalized.message },
        { status: normalized.status }
      );
    }

    return Response.json({
      success: true,
      review: result.data,
    });
  } catch (error) {
    console.error('Teacher verification review error:', error);
    return Response.json(
      { error: error.message || 'Failed to review teacher verification' },
      { status: 500 }
    );
  }
}
