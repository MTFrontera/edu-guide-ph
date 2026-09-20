import { getAuthenticatedUser } from '../../../lib/serverAuth';
import { createSupabaseClientWithAuth } from '../../../lib/apiSupabase';

async function getContext(request) {
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
    .select('id, email, first_name, last_name, role, account_type, school_id, section_id, section_onboarding_complete')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      error: Response.json(
        { error: profileError?.message || 'Profile not found' },
        { status: profileError ? 500 : 404 }
      ),
    };
  }

  return { supabase, profile, user };
}

export async function GET(request) {
  try {
    const context = await getContext(request);
    if (context.error) return context.error;

    const { supabase, profile } = context;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'student';

    if (mode === 'teacher') {
      if (profile.role !== 'teacher') {
        return Response.json({ error: 'Teacher access is required.' }, { status: 403 });
      }

      const { data, error } = await supabase.rpc('teacher_my_sections');
      if (error) throw error;

      return Response.json({
        profile,
        sections: data || [],
      });
    }

    if (mode === 'admin') {
      if (profile.role !== 'admin') {
        return Response.json({ error: 'Admin access is required.' }, { status: 403 });
      }

      const { data, error } = await supabase.rpc('admin_section_management');
      if (error) throw error;

      return Response.json({
        profile,
        management: data || { sections: [], teachers: [], schools: [] },
      });
    }

    if (profile.account_type !== 'student') {
      return Response.json({ error: 'Student access is required.' }, { status: 403 });
    }

    const { data: sections, error: sectionsError } = await supabase
      .from('sections')
      .select('id, name, grade_year, school_id')
      .eq('school_id', profile.school_id)
      .eq('active', true)
      .order('grade_year', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true });

    if (sectionsError) throw sectionsError;

    return Response.json({
      profile,
      sections: sections || [],
    });
  } catch (error) {
    console.error('Sections API error:', error);
    return Response.json(
      { error: error.message || 'Failed to load section data' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const context = await getContext(request);
    if (context.error) return context.error;

    const { supabase, profile } = context;
    const body = await request.json();
    const action = String(body?.action || '').trim();

    if (action === 'set-my-section') {
      if (profile.account_type !== 'student') {
        return Response.json({ error: 'Student access is required.' }, { status: 403 });
      }

      const sectionId = body?.sectionId || null;
      const { data, error } = await supabase.rpc('set_my_section', {
        p_section_id: sectionId,
        p_skip_selection: sectionId === null,
      });

      if (error) throw error;

      return Response.json({ success: true, result: data });
    }

    if (action === 'set-my-course') {
      if (profile.role !== 'teacher') {
        return Response.json({ error: 'Teacher access is required.' }, { status: 403 });
      }

      const courseId = String(body?.courseId || '').trim();
      const selected = Boolean(body?.selected);

      if (!courseId) {
        return Response.json(
          { error: 'Course or subject is required.' },
          { status: 400 }
        );
      }

      const { error } = await supabase.rpc('teacher_set_course', {
        p_course_id: courseId,
        p_selected: selected,
      });

      if (error) throw error;
      return Response.json({ success: true });
    }

    if (profile.role !== 'admin') {
      return Response.json({ error: 'Admin access is required.' }, { status: 403 });
    }

    if (action === 'update-school-admin-email') {
      const schoolId = String(body?.schoolId || '').trim();
      const adminEmail = String(body?.adminEmail || '').trim();

      if (!schoolId || !adminEmail) {
        return Response.json(
          { error: 'School and administrator email are required.' },
          { status: 400 }
        );
      }

      const { error } = await supabase.rpc('admin_update_school_admin_email', {
        p_school_id: schoolId,
        p_admin_email: adminEmail,
      });

      if (error) throw error;
      return Response.json({ success: true });
    }

    if (action === 'create-section') {
      const schoolId = String(body?.schoolId || '').trim();
      const name = String(body?.name || '').trim();
      const gradeYear = String(body?.gradeYear || '').trim();

      if (!schoolId || !name) {
        return Response.json(
          { error: 'School and section name are required.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('admin_create_section', {
        p_school_id: schoolId,
        p_name: name,
        p_grade_year: gradeYear || null,
      });

      if (error) throw error;
      return Response.json({ success: true, sectionId: data });
    }

    if (action === 'create-course') {
      const schoolId = String(body?.schoolId || '').trim();
      const name = String(body?.name || '').trim();

      if (!schoolId || !name) {
        return Response.json(
          { error: 'School and course or subject name are required.' },
          { status: 400 }
        );
      }

      const { data, error } = await supabase.rpc('admin_create_course', {
        p_school_id: schoolId,
        p_name: name,
      });

      if (error) throw error;
      return Response.json({ success: true, courseId: data });
    }

    if (action === 'set-teacher-section') {
      const teacherId = String(body?.teacherId || '').trim();
      const sectionId = String(body?.sectionId || '').trim();
      const assigned = Boolean(body?.assigned);

      if (!teacherId || !sectionId) {
        return Response.json(
          { error: 'Teacher and section are required.' },
          { status: 400 }
        );
      }

      const { error } = await supabase.rpc('admin_set_teacher_section', {
        p_teacher_id: teacherId,
        p_section_id: sectionId,
        p_assigned: assigned,
      });

      if (error) throw error;
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unsupported action.' }, { status: 400 });
  } catch (error) {
    console.error('Sections API action error:', error);
    return Response.json(
      { error: error.message || 'Failed to update section data' },
      { status: 500 }
    );
  }
}
