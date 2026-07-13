const button = document.getElementById("gpsButton");
const result = document.getElementById("result");
const comparisonSection = document.getElementById("comparisonSection");
const mapSection = document.getElementById("mapSection");

let map = null;
let gpsMarker = null;
let ipMarker = null;
let accuracyCircle = null;

const measurements = [];

button.addEventListener("click", startAnalysis);

async function startAnalysis() {

    if (!navigator.geolocation) {

        showError("Ваш браузер не поддерживает Geolocation API.");

        return;

    }

    button.disabled = true;
    button.textContent = "Анализ...";

    measurements.length = 0;

    result.style.display = "block";
    comparisonSection.style.display = "none";

    result.innerHTML = `
        <div class="info">

            <h2>📡 Выполняется анализ GPS...</h2>

            <p id="progress">

                Подготовка...

            </p>

        </div>
    `;

    for (let i = 0; i < 5; i++) {

        document.getElementById("progress").innerHTML =
            `Получение координат ${i + 1} из 5`;

        try {

            const point = await getPosition();

            measurements.push(point);

        }

        catch {

            button.disabled = false;
            button.textContent = "Начать анализ";

            showError("Не удалось получить GPS.");

            return;

        }

        await delay(1000);

    }

    analyzeMeasurements();

}

function getPosition() {

    return new Promise((resolve, reject) => {

        navigator.geolocation.getCurrentPosition(

            position => resolve(position),

            error => reject(error),

            {

                enableHighAccuracy: true,

                timeout:10000,

                maximumAge:0

            }

        );

    });

}

function delay(ms){

    return new Promise(resolve=>setTimeout(resolve,ms));

}

async function analyzeMeasurements(){

    button.disabled=false;
    button.textContent="Начать анализ";

    const first=measurements[0];

    const gpsLat=first.coords.latitude;
    const gpsLon=first.coords.longitude;

    drawMap(

        gpsLat,

        gpsLon,

        first.coords.accuracy

    );

    let totalAccuracy=0;

    let maxAccuracy=0;

    let trust=100;

    let rows="";

    for(let i=0;i<measurements.length;i++){

        const m=measurements[i];

        totalAccuracy+=m.coords.accuracy;

        if(m.coords.accuracy>maxAccuracy){

            maxAccuracy=m.coords.accuracy;

        }

        rows+=`

        <div class="data-row">

            <span>

                Измерение ${i+1}

            </span>

            <span>

                ${m.coords.latitude.toFixed(6)},
                ${m.coords.longitude.toFixed(6)}
                (${m.coords.accuracy.toFixed(1)} м)

            </span>

        </div>

        `;

    }

    const averageAccuracy=

        totalAccuracy/measurements.length;

    let jumps=0;

    let totalDistance=0;

    for(let i=1;i<measurements.length;i++){

        const d=

        calculateDistance(

            measurements[i-1].coords.latitude,

            measurements[i-1].coords.longitude,

            measurements[i].coords.latitude,

            measurements[i].coords.longitude

        );

        totalDistance+=d;

        if(d>0.05){

            jumps++;

        }

    }

    if(averageAccuracy>30){

        trust-=10;

    }

    if(averageAccuracy>100){

        trust-=15;

    }

    if(maxAccuracy>500){

        trust-=20;

    }

    if(jumps>0){

        trust-=jumps*10;

    }

    if(trust<0){

        trust=0;

    }

    let status="🟢 Координаты стабильны";

    if(jumps>0){

        status="🟡 Обнаружены скачки GPS";

    }

    if(jumps>=3){

        status="🔴 Возможен GPS Spoofing";

    }

    result.innerHTML=`

    <div class="info">

        <h2>

            📍 История измерений

        </h2>

        ${rows}

        <br>

        <h2>

            📊 Анализ GPS

        </h2>

        <div class="data-row">

            <span>

                Средняя точность

            </span>

            <span>

                ${averageAccuracy.toFixed(2)} м

            </span>

        </div>

        <div class="data-row">

            <span>

                Максимальная точность

            </span>

            <span>

                ${maxAccuracy.toFixed(2)} м

            </span>

        </div>

        <div class="data-row">

            <span>

                Общее смещение

            </span>

            <span>

                ${(totalDistance*1000).toFixed(1)} м

            </span>

        </div>

        <div class="data-row">

            <span>

                Скачков координат

            </span>

            <span>

                ${jumps}

            </span>

        </div>

        <div class="data-row">

            <span>

                Trust Score

            </span>

            <span>

                ${trust}%

            </span>

        </div>

        <div class="data-row">

            <span>

                Статус

            </span>

            <span>

                ${status}

            </span>

        </div>

    </div>

    `;

    await compareWithIP(

        gpsLat,

        gpsLon,

        trust

    );

}
async function compareWithIP(gpsLat,gpsLon,trust){

    try{

        const response=await fetch("/api/ip");

        const data=await response.json();

        if(!data.success){

            return;

        }

        const ipLat=parseFloat(data.latitude);
        const ipLon=parseFloat(data.longitude);

        let distance=null;

        if(!isNaN(ipLat)&&!isNaN(ipLon)){

            distance=calculateDistance(

                gpsLat,

                gpsLon,

                ipLat,

                ipLon

            );

            if(ipMarker){

                map.removeLayer(ipMarker);

            }

            ipMarker=L.marker([ipLat,ipLon])

                .addTo(map)

                .bindPopup("IP Геолокация");

        }

        let finalTrust=trust;

        let conclusion="🟢 Координаты выглядят достоверными.";

        if(distance!==null&&distance>20){

    finalTrust-=5;

    conclusion="🟢 Небольшое расхождение GPS и IP.";

}

if(distance!==null&&distance>100){

    finalTrust-=15;

    conclusion="🟡 GPS и IP заметно отличаются.";

}

if(distance!==null&&distance>500){

    finalTrust-=25;

    conclusion="🟠 Большое расхождение GPS и IP.";

}

if(distance!==null&&distance>1000){

    finalTrust-=35;

    conclusion="🔴 Высока вероятность GPS Spoofing.";

}

        if(finalTrust<0){

            finalTrust=0;

        }

        comparisonSection.style.display="block";

        comparisonSection.innerHTML=`

        <div class="info">

            <h2>

                🌍 Сравнение GPS и IP

            </h2>

            <div class="data-row">

                <span>IP-адрес</span>

                <span>${data.ip}</span>

            </div>

            <div class="data-row">

                <span>Страна</span>

                <span>${data.country}</span>

            </div>

            <div class="data-row">

                <span>Регион</span>

                <span>${data.region}</span>

            </div>

            <div class="data-row">

                <span>Город</span>

                <span>${data.city}</span>

            </div>

            <div class="data-row">

                <span>Провайдер</span>

                <span>${data.org}</span>

            </div>

            <div class="data-row">

                <span>Расстояние GPS ↔ IP</span>

                <span>

                    ${distance===null
                    ?"Недоступно"
                    :distance.toFixed(1)+" км"}

                </span>

            </div>

            <div class="data-row">

                <span>

                    Итоговый Trust Score

                </span>

                <span>

                    ${finalTrust}%

                </span>

            </div>

            <div class="data-row">

                <span>

                    Заключение

                </span>

                <span>

                    ${conclusion}

                </span>

            </div>

        </div>

        `;

    }

    catch(e){

        console.log(e);

    }

}

function drawMap(lat,lon,accuracy){

    mapSection.style.display="block";

    if(!map){

        map=L.map("map").setView([lat,lon],13);

        L.tileLayer(

            "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",

            {

                attribution:"&copy; OpenStreetMap"

            }

        ).addTo(map);

    }

    if(gpsMarker){

        map.removeLayer(gpsMarker);

    }

    if(accuracyCircle){

        map.removeLayer(accuracyCircle);

    }

    gpsMarker=L.marker([lat,lon])

        .addTo(map)

        .bindPopup("GPS");

    accuracyCircle=L.circle([lat,lon],{

        radius:accuracy

    }).addTo(map);

    map.setView([lat,lon],13);

    setTimeout(()=>{

        map.invalidateSize();

    },200);

}

function calculateDistance(lat1,lon1,lat2,lon2){

    const R=6371;

    const dLat=(lat2-lat1)*Math.PI/180;

    const dLon=(lon2-lon1)*Math.PI/180;

    const a=

        Math.sin(dLat/2)*Math.sin(dLat/2)+

        Math.cos(lat1*Math.PI/180)*

        Math.cos(lat2*Math.PI/180)*

        Math.sin(dLon/2)*

        Math.sin(dLon/2);

    const c=2*Math.atan2(

        Math.sqrt(a),

        Math.sqrt(1-a)

    );

    return R*c;

}

function showError(text){

    result.style.display="block";

    result.innerHTML=`

    <div class="info">

        <h2>

            ❌ Ошибка

        </h2>

        <p>

            ${text}

        </p>

    </div>

    `;

}