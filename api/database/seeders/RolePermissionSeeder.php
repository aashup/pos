<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            'inventory', 'purchase', 'sales', 'pos', 'accounting', 'party', 'branch', 'user', 'role', 'payroll', 'audit',
        ];

        $actions = ['view', 'create', 'edit', 'delete'];

        $permissions = [];
        foreach ($modules as $module) {
            foreach ($actions as $action) {
                $permissions[] = Permission::firstOrCreate([
                    'name' => "{$module}.{$action}",
                    'guard_name' => 'web',
                ]);
            }
        }

        // Flush Spatie cache so newly created permissions are visible to syncPermissions
        app()[PermissionRegistrar::class]->forgetCachedPermissions();

        // Admin — all permissions
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->syncPermissions(Permission::all());

        // Manager — all except delete
        $manager = Role::firstOrCreate(['name' => 'manager', 'guard_name' => 'web']);
        $manager->syncPermissions(
            Permission::where('name', 'not like', '%.delete')->get()
        );

        // Accountant — accounting + view others (excluding audit)
        $accountant = Role::firstOrCreate(['name' => 'accountant', 'guard_name' => 'web']);
        $accountant->syncPermissions(
            Permission::where(function ($q) {
                $q->where('name', 'like', 'accounting.%')
                    ->orWhere(function ($qq) {
                        $qq->where('name', 'like', '%.view')
                            ->where('name', 'not like', 'audit.%');
                    });
            })->get()
        );

        // Salesman — sales + pos + inventory view + party view
        $salesman = Role::firstOrCreate(['name' => 'salesman', 'guard_name' => 'web']);
        $salesman->syncPermissions(
            Permission::where('name', 'like', 'sales.%')
                ->orWhere('name', 'like', 'pos.%')
                ->orWhere('name', 'inventory.view')
                ->orWhere('name', 'party.view')
                ->get()
        );
    }
}
