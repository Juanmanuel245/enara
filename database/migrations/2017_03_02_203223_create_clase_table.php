<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateClaseTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('clase', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->integer('combateArms');
            $table->integer('combateDist');
            $table->integer('golpeCritico');
            $table->integer('domesticar');
            $table->integer('resMagica');
            $table->integer('resFisica');
            $table->integer('supervivencia');
            $table->integer('evasion');
            $table->integer('robar');
            $table->integer('magia');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('clase');
    }
}