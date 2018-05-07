BRUSHES=[
	{
		name:"Pencil",
		size:10,
		minSize:0, // the ratio from size
		density:1,
		minDensity:0,
		//smoothness:2, // the smoothness of the trail: avoid trembling
		sharpness:2, // 0.0[0.2]: soft ~ 1.0: mid ~ +Inf[5]: sharp
		alpha:1
	},
	{
		name:"Brush",
		size:30,
		minSize:0.5,
		density:1,
		minDensity:1,
		//smoothness:2,
		sharpness:1,
		//mixColor:0.3,
		alpha:0.4
	},
	{
		name:"Eraser",
		size:10,
		minSize:1,
		density:1,
		minDensity:1,
		//smoothness:0,
		sharpness:1,
		alpha:1
	}
];
BRUSHES.num=3;

BRUSHES.setNowBrushSize=function(size){
	ENV.nowPen.size=size;
	$("#brush_size").html((size<10?"0":"")+size);
};

BRUSHES.changeNowBrushSize=function(event){
	var e=event.originalEvent;
	var size=ENV.nowPen.size;
	if(e.wheelDelta>0&&size<100){
		size++;
	}
	if(e.wheelDelta<0&&size>1){
		size--;
	}
	BRUSHES.setNowBrushSize(size);
};
