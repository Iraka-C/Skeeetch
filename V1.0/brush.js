BRUSHES=[
	{
		name:"Pencil",
		size:10,
		minSize:0, // the ratio from size in %
		//density:1,
		//minDensity:0,
		//smoothness:2, // the smoothness of the trail: avoid trembling
		sharpness:1, // 0.0[0.2]: soft ~ 1.0: mid ~ +Inf[5]: sharp
		alpha:100 // in %
	},
	{
		name:"Brush",
		size:30,
		minSize:50,
		//density:1,
		//minDensity:1,
		//smoothness:2,
		sharpness:1,
		//mixColor:0.3,
		alpha:40
	},
	{
		name:"Eraser",
		size:10,
		minSize:100,
		//density:1,
		//minDensity:1,
		//smoothness:0,
		sharpness:1,
		alpha:100
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
	if(e.wheelDelta>0&&size<200){
		if(size<10)size+=1;
		else if(size<20)size+=2;
		else if(size<50)size+=5;
		else if(size<100)size+=10;
		else size+=20;
	}
	if(e.wheelDelta<0&&size>1){
		if(size<=10)size-=1;
		else if(size<=20)size-=2;
		else if(size<=50)size-=5;
		else if(size<=100)size-=10;
		else size-=20;
	}
	BRUSHES.setNowBrushSize(size);
};
