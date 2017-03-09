
                    <div class="panel panel-default"> <!-- MI PERSONAJE -->
                        <div class="panel-heading"><img src="{{url('images/personaje/personaje.png')}}" /> Mi Personaje</h3></div>
                        <div class="panel-body">
                            <img src="{{url('images/personaje/level.png')}}" /> <b>Nivel</b> {{Auth::User()->level}} ({{Auth::User()->exp}} / 400)<br />
                            <div class="progress progress-striped active">
                                <div class="progress-bar text-center" role="progressbar" aria-valuenow="500" aria-valuemin="0" aria-valuemax="400" style="width: {{(Auth::User()->exp * 100)/400}}%"></div>
                            </div>
                            <img src="{{url('images/personaje/life.png')}}" /> <b>Vida</b> <div class="anchoFull colorRed">{{vidaPersonaje(Auth::User()->const)}} / 160</div><h6>Regeneracion por hora: 58</h6><br />
                            <img src="{{url('images/personaje/stamina.png')}}" /> <b>Stamina</b><div class="anchoFull colorYellow">{{staminaPersonaje(Auth::User()->stamina, Auth::User()->const)}} / 150</div><h6>Regeneracion por hora: 20</h6><br />
                            <img src="{{url('images/personaje/mana.png')}}" /> <b>Mana</b><div class="anchoFull colorBlue">{{manaPersonaje(Auth::User()->inteligencia)}}</div>
                        </div>
                    </div>


                    <div class="panel panel-default"> <!-- CIUDAD -->
                        <div class="panel-heading"><img src="{{url('images/ciudad/city.png')}}" /> Ciudad</h3></div>
                        <div class="panel-body">
                            Vista General<br />
                            <a href="trabajo">Trabajo</a><br />
                            <a href="entrenamiento">Entrenamiento</a><br />
                            Armero<br />
                            Herrero<br />
                            Alquimista<br />
                            Sastre<br />
                        </div>
                    </div>

                 