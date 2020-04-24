BrushManager.initBrushSelector=function(){
	let menu=$("#brush-selector-menu");
	for(let brush of BrushManager.brushes){
		let block=$("<div class='brush-selector-item'>").text(brush.name);
		EventDistributer.setClick(block,event=>{
			BrushManager.setActiveBrush(brush);
		});
		menu.append(block);
	}
}