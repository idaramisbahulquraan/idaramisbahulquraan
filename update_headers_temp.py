import os

files_to_update = [
    "pages/teacher/timetable.html",
    "pages/teacher/portal.html",
    "pages/teacher/homework.html",
    "pages/teacher/grades.html",
    "pages/teacher/attendance.html",
    "pages/teacher/attendance-report.html",
    "pages/student/timetable.html",
    "pages/student/results.html",
    "pages/student/homework.html",
    "pages/student/portal.html",
    "pages/parent/portal.html",
    "pages/student/attendance.html",
    "pages/admin/users.html",
    "pages/admin/transport.html",
    "pages/admin/timetable.html",
    "pages/admin/support.html",
    "pages/admin/teachers.html",
    "pages/admin/students.html",
    "pages/admin/settings.html",
    "pages/admin/subjects.html",
    "pages/admin/payroll.html",
    "pages/admin/library.html",
    "pages/admin/reports.html",
    "pages/admin/finance.html",
    "pages/admin/integrations.html",
    "pages/admin/fees.html",
    "pages/admin/compliance.html",
    "pages/admin/classes.html",
    "pages/admin/exams.html",
    "pages/admin/backup.html",
    "pages/admin/attendance.html",
    "pages/admin/communication.html",
    "pages/admin/inventory.html",
    "pages/admin/certificates.html",
    "pages/admin/add-teacher.html",
    "pages/admin/attendance-report.html",
    "pages/admin/ai-features.html"
]

target_block = """                <div class="user-profile">
                    <div class="user-info">
                        <p id="userName" style="font-weight: 600;">User</p>
                        <p id="userRole" style="font-size: 0.75rem; color: var(--text-light);">Role</p>
                    </div>
                    <div class="avatar">U</div>
                </div>"""

replacement_block = """                <div class="header-actions">
                    <div class="user-profile">
                        <div class="user-info">
                            <p id="userName" style="font-weight: 600;">User</p>
                            <p id="userRole" style="font-size: 0.75rem; color: var(--text-light);">Role</p>
                        </div>
                        <div class="avatar">U</div>
                    </div>
                </div>"""

base_dir = "f:/codex projects/newappsms2/"

for relative_path in files_to_update:
    full_path = os.path.join(base_dir, relative_path)
    try:
        with open(full_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if target_block in content:
            new_content = content.replace(target_block, replacement_block)
            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)
            print(f"Updated: {relative_path}")
        elif replacement_block in content:
            print(f"Already updated: {relative_path}")
        else:
            print(f"Target block not found in: {relative_path}")
            # Fallback for slight whitespace variations if needed, but let's see first
            
    except Exception as e:
        print(f"Error processing {relative_path}: {e}")
