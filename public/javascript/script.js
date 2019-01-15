var inputs = document.querySelectorAll('.inputfile');
inputs.forEach(function(input){
    input.addEventListener('change', function(event){
	    var label = document.getElementById('label');
	    label.innerHTML = '<div><i class="fas fa-file-image fa-3x" style="color: red;"></i></div>' + this.files[0].name;
	});
});