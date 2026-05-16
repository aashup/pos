<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\ThermalTemplate;
use App\Models\User;
use App\Services\ThermalTemplateDefaults;
use Illuminate\Database\Seeder;

class ThermalTemplateSeeder extends Seeder
{
    public function run(): void
    {
        foreach (Company::all() as $company) {
            $admin = User::where('company_id', $company->id)->first();
            if (! $admin) {
                continue;
            }

            foreach (ThermalTemplateDefaults::sizes() as $paperSize => $cfg) {
                foreach (['invoice', 'kot'] as $type) {
                    $exists = ThermalTemplate::where('company_id', $company->id)
                        ->where('paper_size', $paperSize)
                        ->where('template_type', $type)
                        ->where('is_default', true)
                        ->exists();

                    if ($exists) {
                        continue;
                    }

                    $html = $type === 'invoice'
                        ? ThermalTemplateDefaults::buildInvoiceHtml($cfg)
                        : ThermalTemplateDefaults::buildKotHtml($cfg);

                    ThermalTemplate::create([
                        'company_id'    => $company->id,
                        'name'          => 'Default ' . ucfirst($type) . " {$paperSize}",
                        'html_content'  => $html,
                        'paper_size'    => $paperSize,
                        'template_type' => $type,
                        'is_default'    => true,
                        'created_by'    => $admin->id,
                    ]);
                }
            }
        }
    }
}
