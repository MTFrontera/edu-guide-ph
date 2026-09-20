import { getAuthenticatedUser } from '../../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../../lib/apiSupabase';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export async function POST(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : '';

  const { user, error: authError } = await getAuthenticatedUser(request);
  if (!token || !user || authError) {
    return Response.json({ error: 'Unauthorized', sent: false }, { status: 401 });
  }

  const supabase = createSupabaseClientWithAuth(token);

  try {
    const { data: payload, error: payloadError } = await supabase.rpc(
      'teacher_verification_notification_payload'
    );

    if (payloadError) throw payloadError;

    const adminEmail = String(payload?.schoolAdminEmail || '').trim();
    if (!adminEmail) {
      await supabase.rpc('mark_my_teacher_verification_notification', {
        p_sent: false,
        p_error: 'No school administrator email is configured.',
      });

      return Response.json(
        {
          sent: false,
          error: 'No school administrator email is configured for this school.',
        },
        { status: 409 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      await supabase.rpc('mark_my_teacher_verification_notification', {
        p_sent: false,
        p_error: 'RESEND_API_KEY is not configured.',
      });

      return Response.json(
        {
          sent: false,
          error:
            'Admin email delivery is not configured yet. The verification request is still saved in the admin dashboard.',
        },
        { status: 503 }
      );
    }

    const from =
      process.env.EDUGUIDE_EMAIL_FROM ||
      'EduGuide PH <onboarding@resend.dev>';

    const teacherName = payload?.teacherName || payload?.teacherEmail || 'Teacher applicant';
    const schoolName = payload?.schoolName || 'EduGuide school';

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [adminEmail],
        subject: `EduGuide teacher verification request - ${schoolName}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
            <h2>Teacher verification request</h2>
            <p>A teacher account has submitted verification for <strong>${escapeHtml(schoolName)}</strong>.</p>
            <table style="border-collapse:collapse">
              <tr><td style="padding:4px 12px 4px 0"><strong>Name</strong></td><td>${escapeHtml(teacherName)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0"><strong>Email</strong></td><td>${escapeHtml(payload?.teacherEmail)}</td></tr>
              <tr><td style="padding:4px 12px 4px 0"><strong>Contact number</strong></td><td>${escapeHtml(payload?.teacherPhone || 'Not provided')}</td></tr>
              <tr><td style="padding:4px 12px 4px 0"><strong>Teacher / Employee ID</strong></td><td>${escapeHtml(payload?.employeeId)}</td></tr>
            </table>
            <p>Sign in to the EduGuide admin dashboard to review the private verification document and approve or reject the request.</p>
            <p style="font-size:12px;color:#6b7280">EduGuide does not attach the private ID document to email. Review it only inside the protected admin dashboard.</p>
          </div>
        `,
      }),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        result?.message ||
        result?.error?.message ||
        `Email provider returned status ${response.status}`;

      await supabase.rpc('mark_my_teacher_verification_notification', {
        p_sent: false,
        p_error: errorMessage.slice(0, 500),
      });

      return Response.json(
        { sent: false, error: errorMessage },
        { status: 502 }
      );
    }

    await supabase.rpc('mark_my_teacher_verification_notification', {
      p_sent: true,
      p_error: null,
    });

    return Response.json({
      sent: true,
      emailId: result?.id || null,
    });
  } catch (error) {
    console.error('Teacher verification notification error:', error);

    try {
      await supabase.rpc('mark_my_teacher_verification_notification', {
        p_sent: false,
        p_error: String(error?.message || 'Unknown notification error').slice(0, 500),
      });
    } catch {}

    return Response.json(
      {
        sent: false,
        error: error?.message || 'Could not notify the school administrator.',
      },
      { status: 500 }
    );
  }
}
