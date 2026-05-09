<?php

namespace Database\Seeders;

use App\Models\Branch;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class UserSeeder extends Seeder
{
    // use WithoutModelEvents;

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get the first company and branch
        $company = Company::first();
        $branch = Branch::where('company_id', $company->id)->first();

        if (! $company) {
            $company = Company::factory()->create();
        }
        if (! $branch) {
            $branch = Branch::factory()->create(['company_id' => $company->id]);
        }

        // Create admin user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Admin User',
            'email' => 'admin@demo.com',
            'role' => 'admin',
            'is_active' => true,
        ])->refresh()->assignRole('admin');

        // Create manager user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Manager User',
            'email' => 'manager@demo.com',
            'role' => 'manager',
            'is_active' => true,
        ])->assignRole('manager');

        // Create accountant user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Accountant User',
            'email' => 'accountant@demo.com',
            'role' => 'accountant',
            'is_active' => true,
        ])->assignRole('accountant');

        // Create salesman user
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id' => $branch->id,
            'name' => 'Salesman User',
            'email' => 'salesman@demo.com',
            'role' => 'salesman',
            'is_active' => true,
        ])->assignRole('salesman');

        // Xtrox super-admin — cross-company visibility + impersonation
        User::factory()->create([
            'company_id' => $company->id,
            'branch_id'  => $branch->id,
            'name'       => 'Aashu Xtrox',
            'email'      => 'aashu@xtrox.com',
            'role'       => 'admin',
            'is_active'  => true,
        ])->refresh()->assignRole('admin');

        // Create additional users if needed
        if (app()->environment('local', 'testing')) {
            $users = User::factory()->count(100)->create([
                'company_id' => $company->id,
                'branch_id' => $branch->id,
            ]);

            $users->each(function ($user) {
                // 2. Assign the role (assuming 'role' is a column or property on your model)
                $user->assignRole($user->role);
            });
        }
    }
}
