
function calculateDade(){
    let a = new Date(document.getElementById('dateOne').value);
    let b = new Date(document.getElementById('dateTwo').value);
    const day = Math.ceil(86400000/ (1000*3600*24));
    let timeDiff = Math.abs( b.getTime() - a.getTime());
    let dayDiff = Math.ceil(timeDiff/ (1000*3600*24));
    
    return (isChecked()) ? dayDiff + day : dayDiff

}

function calculateFine() {
    let debt = document.getElementById('debt').value;
    const percent = 0.1;
    return (debt/ 100 * percent * calculateDade()).toFixed(2);

}

function calculatePercents() {
    let debt = document.getElementById('debt').value;
    const percent = 12;
    return (debt / 100 * percent * calculateDade()/365).toFixed(2);


}


function render() {

    let outOne = document.querySelector('.out1');
    let outTwo = document.querySelector('.out2');
    let outThree = document.querySelector('.out3');
    (isNaN(calculateDade()) ) ? outOne.innerText =` введите данные` :  outOne.innerText = ` Просрочка ${calculateDade()} дней`;
    (isNaN(calculateFine()) ) ? outTwo.innerText =` введите данные` :  outTwo.innerText = ` Пеня ${calculateFine()} рублей `;
    (isNaN(calculatePercents()) ) ?  outThree.innerText =` введите данные`: outThree.innerText = ` Проценты  ${calculatePercents()} рублей`;



    
}

function isChecked(){
    let chbox = document.querySelector('#checkOne')
    return (chbox.checked)
      

}

document.querySelector("button").onclick = () => {

    render();

}




