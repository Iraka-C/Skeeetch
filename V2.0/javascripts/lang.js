/**
 * Language Setting
 */
LANG={};

switch(Cookies.get("lang")){
case "zh":LANG=LANG_ZH;break;
case "en":
default:LANG=LANG_EN;
};
//LANG=LANG_ZH; // language setting, read from cookie
Lang=text=>LANG[text]||text; // if not found, use the original text
LANG.init=()=>{
	for(let id of Object.keys(LANG._id)){ // set DOM contents
		let item=document.getElementById(id);
		if(!id||!item)continue; // not found
		
		switch(item.nodeName){
			case "DIV":item.innerHTML=LANG._id[id];break;
			case "INPUT":item.value=LANG._id[id];break;
		}
	}
}
Cookies.set("lang","zh");