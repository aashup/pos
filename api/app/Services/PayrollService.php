<?php

namespace App\Services;

use App\Models\Employee;
use App\Models\PayrollEntry;
use App\Models\PayrollRun;
use Illuminate\Support\Facades\DB;

class PayrollService
{
    /**
     * Generate a draft payroll run for the given month/year.
     * present_days defaults to working_days (full month — adjust after generation).
     */
    public function generate(string $companyId, int $month, int $year, int $workingDays = 26): PayrollRun
    {
        $employees = Employee::where('company_id', $companyId)
            ->where('is_active', true)
            ->with(['salaryStructure'])
            ->get();

        return DB::transaction(function () use ($companyId, $month, $year, $workingDays, $employees) {
            $run = PayrollRun::create([
                'company_id' => $companyId,
                'month' => $month,
                'year' => $year,
                'working_days' => $workingDays,
                'status' => 'draft',
            ]);

            $totalGross = 0;
            $totalDeductions = 0;
            $totalNet = 0;
            $totalPfEmployer = 0;
            $totalEsiEmployer = 0;

            foreach ($employees as $employee) {
                $structure = $employee->salaryStructure;
                if (! $structure) {
                    continue;
                }

                $entry = $this->computeEntry($run, $employee, $structure, $workingDays, $workingDays);

                $totalGross += (float) $entry->gross_salary;
                $totalDeductions += (float) $entry->total_deductions;
                $totalNet += (float) $entry->net_salary;
                $totalPfEmployer += (float) $entry->pf_employer;
                $totalEsiEmployer += (float) $entry->esi_employer;
            }

            $run->update([
                'total_gross' => round($totalGross, 2),
                'total_deductions' => round($totalDeductions, 2),
                'total_net' => round($totalNet, 2),
                'total_pf_employer' => round($totalPfEmployer, 2),
                'total_esi_employer' => round($totalEsiEmployer, 2),
            ]);

            return $run;
        });
    }

    /**
     * Recompute a single payroll entry after present_days is edited.
     */
    public function recomputeEntry(PayrollEntry $entry): void
    {
        $employee = $entry->employee;
        $structure = $employee->salaryStructure;
        if (! $structure) {
            return;
        }

        $run = $entry->payrollRun;
        $this->computeEntry($run, $employee, $structure, $entry->present_days, $run->working_days, $entry);
        $this->recalculateTotals($run);
    }

    /**
     * Recalculate totals on the payroll run after any entry changes.
     */
    public function recalculateTotals(PayrollRun $run): void
    {
        $run->loadMissing('entries');

        $run->update([
            'total_gross' => round($run->entries->sum('gross_salary'), 2),
            'total_deductions' => round($run->entries->sum('total_deductions'), 2),
            'total_net' => round($run->entries->sum('net_salary'), 2),
            'total_pf_employer' => round($run->entries->sum('pf_employer'), 2),
            'total_esi_employer' => round($run->entries->sum('esi_employer'), 2),
        ]);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private function computeEntry(
        PayrollRun $run,
        Employee $employee,
        $structure,
        int $presentDays,
        int $workingDays,
        ?PayrollEntry $existing = null
    ): PayrollEntry {
        $ratio = $workingDays > 0 ? $presentDays / $workingDays : 0;

        $basic = round((float) $structure->basic * $ratio, 2);
        $hra = round((float) $structure->hra * $ratio, 2);
        $da = round((float) $structure->da * $ratio, 2);
        $conveyance = round((float) $structure->conveyance * $ratio, 2);
        $medical = round((float) $structure->medical * $ratio, 2);
        $specialAllowance = round((float) $structure->special_allowance * $ratio, 2);

        // Snapshot custom components: pro-rate earnings, keep deductions fixed
        $customEarnings = 0.0;
        $customDeductions = 0.0;
        $customSnapshot = [];
        foreach (($structure->custom_components ?? []) as $comp) {
            if (($comp['type'] ?? '') === 'earning') {
                $proRated = round((float) $comp['amount'] * $ratio, 2);
                $customEarnings += $proRated;
                $customSnapshot[] = [
                    'definition_id' => $comp['definition_id'],
                    'name'          => $comp['name'],
                    'type'          => 'earning',
                    'amount'        => $proRated,
                ];
            } else {
                $fixed = round((float) $comp['amount'], 2);
                $customDeductions += $fixed;
                $customSnapshot[] = [
                    'definition_id' => $comp['definition_id'],
                    'name'          => $comp['name'],
                    'type'          => 'deduction',
                    'amount'        => $fixed,
                ];
            }
        }

        $gross = round($basic + $hra + $da + $conveyance + $medical + $specialAllowance + $customEarnings, 2);

        $pfEmployee = 0;
        $pfEmployer = 0;
        if ($employee->is_pf_applicable) {
            $pfEmployee = round($basic * 0.12, 2);
            $pfEmployer = round($basic * 0.13, 2);
        }

        $esiEmployee = 0;
        $esiEmployer = 0;
        if ($employee->is_esi_applicable && $gross <= 21000) {
            $esiEmployee = round($gross * 0.0075, 2);
            $esiEmployer = round($gross * 0.0325, 2);
        }

        $pt = round((float) $structure->professional_tax, 2);
        $tds = round((float) $structure->tds_amount, 2);

        $totalDeductions = round($pfEmployee + $esiEmployee + $pt + $tds + $customDeductions, 2);
        $netSalary = round($gross - $totalDeductions, 2);

        $data = [
            'payroll_run_id'    => $run->id,
            'employee_id'       => $employee->id,
            'present_days'      => $presentDays,
            'basic'             => $basic,
            'hra'               => $hra,
            'da'                => $da,
            'conveyance'        => $conveyance,
            'medical'           => $medical,
            'special_allowance' => $specialAllowance,
            'gross_salary'      => $gross,
            'pf_employee'       => $pfEmployee,
            'esi_employee'      => $esiEmployee,
            'professional_tax'  => $pt,
            'tds'               => $tds,
            'total_deductions'  => $totalDeductions,
            'net_salary'        => $netSalary,
            'pf_employer'       => $pfEmployer,
            'esi_employer'      => $esiEmployer,
            'custom_components' => $customSnapshot ?: null,
        ];

        if ($existing) {
            $existing->update($data);

            return $existing->fresh();
        }

        return PayrollEntry::create($data);
    }
}
