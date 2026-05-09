<?php

namespace App\Traits;

use App\Models\Company;

trait BelongsToCompany
{
    protected static function bootBelongsToCompany(): void
    {
        static::creating(function ($model) {
            if (empty($model->company_id) && auth()->check()) {
                $model->company_id = auth()->user()->company_id;
            }
        });

        static::addGlobalScope('company', function ($builder) {
            if (auth()->check()) {
                $builder->where($builder->getModel()->getTable().'.company_id', auth()->user()->company_id);
            }
        });
    }

    public function company()
    {
        return $this->belongsTo(Company::class);
    }
}
