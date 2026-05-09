<?php

namespace App\Models;

use App\Traits\BelongsToCompany;
use Spatie\Activitylog\Models\Activity as SpatieActivity;

class Activity extends SpatieActivity
{
    use BelongsToCompany;

    public $guarded = [];
}
