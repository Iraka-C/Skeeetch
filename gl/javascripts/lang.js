/**
 * Language Setting
 */
LANG={};
LANG.langList={
	"zh":LANG_ZH,
	"en":LANG_EN
};
LANG.nowLang="en";

Lang=text=>LANG.target[text]||text; // if not found, use the original text
LANG.init=(sysParams)=>{
	// Language specification
	// sysParams.windowParams.query > sysParams.preference.language > sysParams.windowParams.lang
	const getLangTag=s=>typeof(s)=="string"?s.substring(0,s.search(/-|$/g)):"";
	const queryTag=getLangTag(sysParams.windowParams.query.lang);
	const prefTag=getLangTag(sysParams.preference.language);
	const sysTag=getLangTag(sysParams.windowParams.lang);

	// English as default
	LANG.target=LANG.langList[queryTag]||LANG.langList[prefTag]||LANG.langList[sysTag]||LANG_EN;
	LANG.nowLang=LANG.target._tag;

	for(const id of Object.keys(LANG.target._id)){ // set DOM contents
		if(!id)continue; // invalid key
		const item=document.getElementById(id);
		if(!item)continue; // not found
		
		switch(item.nodeName){
			case "DIV":item.innerHTML=LANG.target._id[id];break;
			case "INPUT":item.value=LANG.target._id[id];break;
		}
	}
}