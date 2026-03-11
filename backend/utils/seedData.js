const bcrypt = require('bcryptjs');
const { query, closePool } = require('../config/database');
require('dotenv').config();

async function upsertUser(user) {
    await query(`
        INSERT INTO tasktracker.users (
            employee_code, full_name, email, password_hash,
            role_id, manager_id, department, designation
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (email)
        DO UPDATE SET
            employee_code = EXCLUDED.employee_code,
            full_name = EXCLUDED.full_name,
            role_id = EXCLUDED.role_id,
            manager_id = EXCLUDED.manager_id,
            department = EXCLUDED.department,
            designation = EXCLUDED.designation,
            updated_at = NOW()
    `, [
        user.employeeCode,
        user.fullName,
        user.email,
        user.passwordHash,
        user.roleId,
        user.managerId || null,
        user.department || null,
        user.designation || null
    ]);
}

async function getUserIdByEmail(email) {
    const result = await query(
        'SELECT user_id AS "UserID" FROM tasktracker.users WHERE email = $1 LIMIT 1',
        [email]
    );
    return result.rows[0]?.UserID || null;
}

async function seedData() {
    try {
        console.log('[Seed] Connected to database...');

        const adminPassword = await bcrypt.hash('Admin@123', 10);
        const defaultPassword = await bcrypt.hash('Password@123', 10);

        await upsertUser({
            employeeCode: 'EMP001',
            fullName: 'System Administrator',
            email: 'admin@ubtiinc.com',
            passwordHash: adminPassword,
            roleId: 1,
            department: 'IT Administration',
            designation: 'System Administrator'
        });
        console.log('[Seed] Admin user created');

        await upsertUser({
            employeeCode: 'EMP010',
            fullName: 'Rajesh Kumar',
            email: 'rajesh.k@ubtiinc.com',
            passwordHash: defaultPassword,
            roleId: 2,
            department: 'Engineering',
            designation: 'Technical Lead'
        });
        console.log('[Seed] Manager 1 created');

        await upsertUser({
            employeeCode: 'EMP011',
            fullName: 'Priya Sharma',
            email: 'priya.s@ubtiinc.com',
            passwordHash: defaultPassword,
            roleId: 2,
            department: 'Quality Assurance',
            designation: 'QA Lead'
        });
        console.log('[Seed] Manager 2 created');

        const manager1Id = await getUserIdByEmail('rajesh.k@ubtiinc.com');
        const manager2Id = await getUserIdByEmail('priya.s@ubtiinc.com');

        const users = [
            { employeeCode: 'EMP101', fullName: 'Arun Prasad', email: 'arun.p@ubtiinc.com', department: 'Engineering', designation: 'Software Developer', managerId: manager1Id },
            { employeeCode: 'EMP102', fullName: 'Deepa Venkat', email: 'deepa.v@ubtiinc.com', department: 'Engineering', designation: 'Full Stack Developer', managerId: manager1Id },
            { employeeCode: 'EMP103', fullName: 'Karthik Rajan', email: 'karthik.r@ubtiinc.com', department: 'Engineering', designation: 'Backend Developer', managerId: manager1Id },
            { employeeCode: 'EMP201', fullName: 'Sneha Patel', email: 'sneha.p@ubtiinc.com', department: 'Quality Assurance', designation: 'QA Engineer', managerId: manager2Id },
            { employeeCode: 'EMP202', fullName: 'Vikram Singh', email: 'vikram.s@ubtiinc.com', department: 'Quality Assurance', designation: 'Test Analyst', managerId: manager2Id }
        ];

        for (const user of users) {
            await upsertUser({
                ...user,
                passwordHash: defaultPassword,
                roleId: 3
            });
            console.log(`[Seed] User ${user.fullName} created`);
        }

        console.log('\n====================================================');
        console.log('SEED DATA COMPLETE');
        console.log('====================================================');
        console.log('Login Credentials:');
        console.log('  Admin:    admin@ubtiinc.com     / Admin@123');
        console.log('  Manager:  rajesh.k@ubtiinc.com  / Password@123');
        console.log('  Manager:  priya.s@ubtiinc.com   / Password@123');
        console.log('  User:     arun.p@ubtiinc.com    / Password@123');
        console.log('  User:     deepa.v@ubtiinc.com   / Password@123');
        console.log('  User:     karthik.r@ubtiinc.com / Password@123');
        console.log('  User:     sneha.p@ubtiinc.com   / Password@123');
        console.log('  User:     vikram.s@ubtiinc.com  / Password@123');
        console.log('====================================================');
    } catch (err) {
        console.error('[Seed] Error:', err);
    } finally {
        await closePool();
        process.exit(0);
    }
}

seedData();
