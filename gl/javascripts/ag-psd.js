(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.agPsd = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var effectsHelpers_1 = require("./effectsHelpers");
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var descriptor_1 = require("./descriptor");
var handlers = [];
var handlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    handlers.push(handler);
    handlersMap[handler.key] = handler;
}
function getHandler(key) {
    return handlersMap[key];
}
exports.getHandler = getHandler;
function getHandlers() {
    return handlers;
}
exports.getHandlers = getHandlers;
function revMap(map) {
    var result = {};
    Object.keys(map).forEach(function (key) { return result[map[key]] = key; });
    return result;
}
// textGridding.None
var textGridding = {
    none: 'None',
};
var textGriddingRev = revMap(textGridding);
function toTextGridding(value) {
    return textGriddingRev[value.split('.')[1]] || 'none';
}
function fromTextGridding(value) {
    return "textGridding." + (textGridding[value] || 'None');
}
// Ornt.Hrzn | Ornt.Vrtc
var Ornt = {
    horizontal: 'Hrzn',
    vertical: 'Vrtc',
};
var OrntRev = revMap(Ornt);
function toOrientation(value) {
    return OrntRev[value.split('.')[1]] || 'horizontal';
}
function fromOrientation(value) {
    return "textGridding." + (Ornt[value] || 'Hrzn');
}
// Annt.antiAliasSharp | Annt.Anno | Annt.AnCr | Annt.AnSt | Annt.AnSm
var Annt = {
    none: 'Anno',
    sharp: 'antiAliasSharp',
    crisp: 'AnCr',
    strong: 'AnSt',
    smooth: 'AnSm',
};
var AnntRev = revMap(Annt);
function toAntialias(value) {
    return AnntRev[value.split('.')[1]] || 'none';
}
function fromAntialias(value) {
    return "Annt." + (Annt[value] || 'Anno');
}
// warpStyle.warpNone | warpStyle.warpArc | warpStyle.warpArcLower | warpStyle.warpArcUpper | warpStyle.warpArch
// warpStyle.warpBulge | warpStyle.warpShellLower | warpStyle.warpShellUpper | warpStyle.warpFlag
// warpStyle.warpWave | warpStyle.warpFish | warpStyle.warpRise | warpStyle.warpFisheye |
// warpStyle.warpInflate | warpStyle.warpSqueeze | warpStyle.warpTwist
var warpStyle = {
    none: 'warpNone',
    arc: 'warpArc',
    arcLower: 'warpArcLower',
    arcUpper: 'warpArcUpper',
    arch: 'warpArch',
    bulge: 'warpBulge',
    shellLower: 'warpShellLower',
    shellUpper: 'warpShellUpper',
    flag: 'warpFlag',
    wave: 'warpWave',
    fish: 'warpFish',
    rise: 'warpRise',
    fisheye: 'warpFisheye',
    inflate: 'warpInflate',
    squeeze: 'warpSqueeze',
    twist: 'warpTwist',
};
var warpStyleRev = revMap(warpStyle);
function toWarpStyle(value) {
    return warpStyleRev[value.split('.')[1]] || 'none';
}
function fromWarpStyle(value) {
    return "warpStyle." + (warpStyle[value] || 'warpNone');
}
addHandler('TySh', function (target) { return target.text !== undefined; }, function (reader, target) {
    var version = psdReader_1.readInt16(reader);
    if (version !== 1) {
        throw new Error("Invalid TySh version: " + version);
    }
    var transform = [
        psdReader_1.readFloat64(reader),
        psdReader_1.readFloat64(reader),
        psdReader_1.readFloat64(reader),
        psdReader_1.readFloat64(reader),
        psdReader_1.readFloat64(reader),
        psdReader_1.readFloat64(reader),
    ];
    var textVersion = psdReader_1.readInt16(reader);
    var descriptorVersion = psdReader_1.readInt32(reader);
    if (textVersion !== 50 || descriptorVersion !== 16) {
        throw new Error("Invalid TySh text version: " + textVersion + "/" + descriptorVersion);
    }
    var text = descriptor_1.readDescriptorStructure(reader);
    // console.log('EngineData:', JSON.stringify(parseEngineData(text.EngineData), null, 2), '\n');
    var warpVersion = psdReader_1.readInt16(reader);
    var warpDescriptorVersion = psdReader_1.readInt32(reader);
    if (warpVersion !== 1 || warpDescriptorVersion !== 16) {
        throw new Error("Invalid TySh warp version: " + warpVersion + " " + warpDescriptorVersion);
    }
    var warp = descriptor_1.readDescriptorStructure(reader);
    var left = psdReader_1.readInt32(reader);
    var top = psdReader_1.readInt32(reader);
    var right = psdReader_1.readInt32(reader);
    var bottom = psdReader_1.readInt32(reader);
    target.text = {
        transform: transform, left: left, top: top, right: right, bottom: bottom,
        text: text['Txt '],
        index: text.TextIndex || 0,
        gridding: toTextGridding(text.textGridding),
        antialias: toAntialias(text.AntA),
        orientation: toOrientation(text.Ornt),
        warp: {
            style: toWarpStyle(warp.warpStyle),
            value: warp.warpValue || 0,
            perspective: warp.warpPerspective || 0,
            perspectiveOther: warp.warpPerspectiveOther || 0,
            rotate: toOrientation(warp.warpRotate),
        },
    };
}, function (writer, target) {
    var text = target.text;
    var warp = text.warp || {};
    var transform = text.transform || [1, 0, 0, 1, 0, 0];
    var textDescriptor = {
        'Txt ': text.text,
        textGridding: fromTextGridding(text.gridding),
        Ornt: fromOrientation(text.orientation),
        AntA: fromAntialias(text.antialias),
        TextIndex: text.index || 0,
    };
    var warpDescriptor = {
        warpStyle: fromWarpStyle(warp.style),
        warpValue: warp.value || 0,
        warpPerspective: warp.perspective || 0,
        warpPerspectiveOther: warp.perspectiveOther || 0,
        warpRotate: fromOrientation(warp.rotate),
    };
    psdWriter_1.writeInt16(writer, 1); // version
    for (var i = 0; i < 6; i++) {
        psdWriter_1.writeFloat64(writer, transform[i] || 0);
    }
    psdWriter_1.writeInt16(writer, 50); // text version
    psdWriter_1.writeInt32(writer, 16); // text descriptor version
    descriptor_1.writeDescriptorStructure(writer, '', 'TxLr', textDescriptor);
    psdWriter_1.writeInt16(writer, 1); // warp version
    psdWriter_1.writeInt32(writer, 16); // warp descriptor version
    descriptor_1.writeDescriptorStructure(writer, '', 'warp', warpDescriptor);
    psdWriter_1.writeInt32(writer, text.left || 0);
    psdWriter_1.writeInt32(writer, text.top || 0);
    psdWriter_1.writeInt32(writer, text.right || 0);
    psdWriter_1.writeInt32(writer, text.bottom || 0);
});
addHandler('luni', function (target) { return target.name !== undefined; }, function (reader, target, left) {
    target.name = psdReader_1.readUnicodeString(reader);
    psdReader_1.skipBytes(reader, left()); // TEMP: skipping
}, function (writer, target) {
    psdWriter_1.writeUnicodeString(writer, target.name);
});
addHandler('lnsr', function (target) { return target.nameSource !== undefined; }, function (reader, target) { return target.nameSource = psdReader_1.readSignature(reader); }, function (writer, target) { return psdWriter_1.writeSignature(writer, target.nameSource); });
addHandler('lyid', function (target) { return target.id !== undefined; }, function (reader, target) { return target.id = psdReader_1.readUint32(reader); }, function (writer, target) { return psdWriter_1.writeUint32(writer, target.id); });
addHandler('clbl', function (target) { return target.blendClippendElements !== undefined; }, function (reader, target) {
    target.blendClippendElements = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.blendClippendElements ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('infx', function (target) { return target.blendInteriorElements !== undefined; }, function (reader, target) {
    target.blendInteriorElements = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.blendInteriorElements ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('knko', function (target) { return target.knockout !== undefined; }, function (reader, target) {
    target.knockout = !!psdReader_1.readUint8(reader);
    psdReader_1.skipBytes(reader, 3);
}, function (writer, target) {
    psdWriter_1.writeUint8(writer, target.knockout ? 1 : 0);
    psdWriter_1.writeZeros(writer, 3);
});
addHandler('lspf', function (target) { return target.protected !== undefined; }, function (reader, target) {
    var flags = psdReader_1.readUint32(reader);
    target.protected = {
        transparency: (flags & 0x01) !== 0,
        composite: (flags & 0x02) !== 0,
        position: (flags & 0x04) !== 0,
    };
}, function (writer, target) {
    var flags = (target.protected.transparency ? 0x01 : 0) |
        (target.protected.composite ? 0x02 : 0) |
        (target.protected.position ? 0x04 : 0);
    psdWriter_1.writeUint32(writer, flags);
});
addHandler('lclr', function (target) { return target.sheetColors !== undefined; }, function (reader, target) {
    target.sheetColors = {
        color1: psdReader_1.readUint32(reader),
        color2: psdReader_1.readUint32(reader),
    };
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.sheetColors.color1);
    psdWriter_1.writeUint32(writer, target.sheetColors.color2);
});
addHandler('shmd', function (target) { return target.metadata !== undefined; }, function (reader, target) {
    var count = psdReader_1.readUint32(reader);
    target.metadata = [];
    for (var i = 0; i < count; i++) {
        var signature = psdReader_1.readSignature(reader);
        if (signature !== '8BIM')
            throw new Error("Invalid signature: '" + signature + "'");
        var key = psdReader_1.readSignature(reader);
        var copy = !!psdReader_1.readUint8(reader);
        psdReader_1.skipBytes(reader, 3);
        var length_1 = psdReader_1.readUint32(reader);
        var data = helpers_1.toArray(psdReader_1.readBytes(reader, length_1));
        target.metadata.push({ key: key, copy: copy, data: data });
    }
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.metadata.length);
    for (var i = 0; i < target.metadata.length; i++) {
        var item = target.metadata[i];
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, item.key);
        psdWriter_1.writeUint8(writer, item.copy ? 1 : 0);
        psdWriter_1.writeZeros(writer, 3);
        psdWriter_1.writeUint32(writer, item.data.length);
        psdWriter_1.writeBytes(writer, new Uint8Array(item.data));
    }
});
addHandler('fxrp', function (target) { return target.referencePoint !== undefined; }, function (reader, target) {
    target.referencePoint = {
        x: psdReader_1.readFloat64(reader),
        y: psdReader_1.readFloat64(reader),
    };
}, function (writer, target) {
    psdWriter_1.writeFloat64(writer, target.referencePoint.x);
    psdWriter_1.writeFloat64(writer, target.referencePoint.y);
});
addHandler('lsct', function (target) { return target.sectionDivider !== undefined; }, function (reader, target, left) {
    var item = {};
    item.type = psdReader_1.readUint32(reader);
    if (left()) {
        var signature = psdReader_1.readSignature(reader);
        if (signature !== '8BIM')
            throw new Error("Invalid signature: '" + signature + "'");
        item.key = psdReader_1.readSignature(reader);
    }
    if (left()) {
        // 0 = normal
        // 1 = scene group, affects the animation timeline.
        item.subType = psdReader_1.readUint32(reader);
    }
    target.sectionDivider = item;
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.sectionDivider.type);
    if (target.sectionDivider.key) {
        psdWriter_1.writeSignature(writer, '8BIM');
        psdWriter_1.writeSignature(writer, target.sectionDivider.key);
        if (target.sectionDivider.subtype !== undefined)
            psdWriter_1.writeUint32(writer, target.sectionDivider.subtype);
    }
});
addHandler('lyvr', function (target) { return target.version !== undefined; }, function (reader, target) {
    target.version = psdReader_1.readUint32(reader);
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.version);
});
addHandler('lrFX', function (target) { return target.effects !== undefined; }, function (reader, target, left) {
    target.effects = effectsHelpers_1.readEffects(reader);
    psdReader_1.skipBytes(reader, left()); // TEMP: skipping
}, function (writer, target) {
    effectsHelpers_1.writeEffects(writer, target.effects);
});
// addHandler(
// 	'Txt2',
// 	target => !!(target as any)['__Txt2'], // target.text !== undefined,
// 	(reader, target, left) => {
// 		const textEngineData = readBytes(reader, left());
// 		(target as any)['__Txt2'] = Array.from(textEngineData);
// 		console.log('Txt2:textEngineData', parseEngineData(textEngineData));
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, new Uint8Array((target as any)['__Txt2'])); // new Uint8Array(target.textEngineData!));
// 	},
// );
addHandler('FMsk', function (target) { return target.filterMask !== undefined; }, function (reader, target) {
    target.filterMask = {
        colorSpace: helpers_1.readColor(reader),
        opacity: psdReader_1.readUint16(reader),
    };
}, function (writer, target) {
    psdWriter_1.writeBytes(writer, new Uint8Array(target.filterMask.colorSpace));
    psdWriter_1.writeUint16(writer, target.filterMask.opacity);
});
// TODO: implement
addHandler('lfx2', function (target) { return !target; }, // target.objectBasedEffectsLayerInfo !== undefined,
function (reader, _target, left) {
    psdReader_1.skipBytes(reader, left());
    // const version = readUint32(reader);
    // const descriptorVersion = readUint32(reader);
    // const name = reader.readUnicodeString();
    // const classId = readStringOrClassId(reader);
    // const itemsCount = readUint32(reader);
    //for (let i = 0; i < itemsCount; i++) {
    //	console.log('read item');
    //	const key = readStringOrClassId(reader);
    //	console.log('key', [key]);
    //}
    //target.objectBasedEffectsLayerInfo = {
    //	version,
    //	descriptorVersion,
    //	descriptor: {
    //		name,
    //		classId,
    //		//...
    //	},
    //};
}, function (_writer, _target) {
    //...
});


},{"./descriptor":2,"./effectsHelpers":3,"./helpers":4,"./psdReader":8,"./psdWriter":9}],2:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
function readAsciiStringOrClassId(reader) {
    var length = psdReader_1.readInt32(reader);
    var result = length === 0 ? psdReader_1.readSignature(reader) : psdReader_1.readAsciiString(reader, length);
    return result;
}
function writeAsciiString(writer, value) {
    psdWriter_1.writeInt32(writer, value.length);
    for (var i = 0; i < value.length; i++) {
        psdWriter_1.writeUint8(writer, value.charCodeAt(i));
    }
}
function writeClassId(writer, value) {
    psdWriter_1.writeInt32(writer, 0);
    psdWriter_1.writeSignature(writer, value);
}
function writeAsciiStringOrClassId(writer, value) {
    if (value.length === 4) {
        writeClassId(writer, value);
    }
    else {
        writeAsciiString(writer, value);
    }
}
function readDescriptorStructure(reader) {
    readClassStructure(reader);
    var itemsCount = psdReader_1.readUint32(reader);
    var object = {};
    for (var i = 0; i < itemsCount; i++) {
        var key = readAsciiStringOrClassId(reader);
        var type = psdReader_1.readSignature(reader);
        var data = readOSType(reader, type);
        // console.log('>', `"${key}"`, type);
        object[key] = data;
    }
    return object;
}
exports.readDescriptorStructure = readDescriptorStructure;
var fieldToType = {
    'Txt ': 'TEXT',
    textGridding: 'enum',
    Ornt: 'enum',
    AntA: 'enum',
    TextIndex: 'long',
    warpStyle: 'enum',
    warpValue: 'doub',
    warpPerspective: 'doub',
    warpPerspectiveOther: 'doub',
    warpRotate: 'enum',
    EngineData: 'tdta',
    PstS: 'bool',
    Inte: 'enum',
    printSixteenBit: 'bool',
    printerName: 'TEXT',
    printProofSetup: 'Objc',
    Bltn: 'enum',
};
var fieldToExtType = {
    printProofSetup: { name: 'Proof Setup', classId: 'proofSetup' },
};
function writeDescriptorStructure(writer, name, classId, value) {
    writeClassStructure(writer, name, classId);
    var keys = Object.keys(value);
    psdWriter_1.writeUint32(writer, keys.length);
    for (var _i = 0, keys_1 = keys; _i < keys_1.length; _i++) {
        var key = keys_1[_i];
        var type = fieldToType[key];
        writeAsciiStringOrClassId(writer, key);
        psdWriter_1.writeSignature(writer, type || 'long');
        writeOSType(writer, type || 'long', value[key], fieldToExtType[key]);
        if (!type) {
            console.log('missing descriptor field type for', key);
        }
    }
}
exports.writeDescriptorStructure = writeDescriptorStructure;
function readOSType(reader, type) {
    switch (type) {
        case 'obj ': // Reference
            return readReferenceStructure(reader);
        case 'Objc': // Descriptor
        case 'GlbO': // GlobalObject same as Descriptor
            return readDescriptorStructure(reader);
        case 'VlLs': // List
            return readListStructure(reader);
        case 'doub': // Double
            return psdReader_1.readFloat64(reader);
        case 'UntF': // Unit double
            return readUnitDoubleStructure(reader);
        case 'UnFl': // Unit float
            return readUnitFloatStructure(reader);
        case 'TEXT': // String
            return psdReader_1.readUnicodeString(reader);
        case 'enum': // Enumerated
            return readEnumerated(reader);
        case 'long': // Integer
            return psdReader_1.readInt32(reader);
        case 'comp': // Large Integer
            return readLargeInteger(reader);
        case 'bool': // Boolean
            return !!psdReader_1.readUint8(reader);
        case 'type': // Class
        case 'GlbC': // Class
            return readClassStructure(reader);
        case 'alis': // Alias
            return readAliasStructure(reader);
        case 'tdta': // Raw Data
            return readRawData(reader);
        case 'ObAr': // Object array
            throw new Error('not implemented: ObAr');
        case 'Pth ': // File path
            return readFilePath(reader);
        default:
            throw new Error("Invalid TySh descriptor OSType: " + type + " at " + reader.offset.toString(16));
    }
}
function writeOSType(writer, type, value, extType) {
    switch (type) {
        // case 'obj ': // Reference
        // 	return readReferenceStructure(reader);
        case 'Objc': // Descriptor
            // case 'GlbO': // GlobalObject same as Descriptor
            writeDescriptorStructure(writer, extType.name, extType.classId, value);
            break;
        // case 'VlLs': // List
        // 	return readListStructure(reader);
        case 'doub': // Double
            psdWriter_1.writeFloat64(writer, value);
            break;
        // case 'UntF': // Unit double
        // 	return readUnitDoubleStructure(reader);
        // case 'UnFl': // Unit float
        // 	return readUnitFloatStructure(reader);
        case 'TEXT': // String
            psdWriter_1.writeUnicodeStringWithPadding(writer, value);
            break;
        case 'enum': // Enumerated
            writeEnumerated(writer, value);
            break;
        case 'long': // Integer
            psdWriter_1.writeInt32(writer, value);
            break;
        // case 'comp': // Large Integer
        // 	return readLargeInteger(reader);
        case 'bool': // Boolean
            psdWriter_1.writeUint8(writer, value ? 1 : 0);
            break;
        // case 'type': // Class
        // case 'GlbC': // Class
        // 	return readClassStructure(reader);
        // case 'alis': // Alias
        // 	return readAliasStructure(reader);
        case 'tdta': // Raw Data
            writeRawData(writer, value);
            break;
        // case 'ObAr': // Object array
        // 	throw new Error('not implemented: ObAr');
        // case 'Pth ': // File path
        // 	return readFilePath(reader);
        default:
            throw new Error("Not implemented TySh descriptor OSType: " + type);
    }
}
function readReferenceStructure(reader) {
    var itemsCount = psdReader_1.readInt32(reader);
    var items = [];
    for (var i = 0; i < itemsCount; i++) {
        var type = psdReader_1.readSignature(reader);
        switch (type) {
            case 'prop': // Property
                items.push(readPropertyStructure(reader));
                break;
            case 'Clss': // Class
                items.push(readClassStructure(reader));
                break;
            case 'Enmr': // Enumerated Reference
                items.push(readEnumeratedReference(reader));
                break;
            case 'rele': // Offset
                items.push(readOffsetStructure(reader));
                break;
            case 'Idnt': // Identifier
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'indx': // Index
                items.push(psdReader_1.readInt32(reader));
                break;
            case 'name': // Name
                items.push(psdReader_1.readUnicodeString(reader));
                break;
            default:
                throw new Error("Invalid TySh descriptor Reference type: " + type);
        }
    }
    return items;
}
function readPropertyStructure(reader) {
    var _a = readClassStructure(reader), name = _a.name, classID = _a.classID;
    var keyID = readAsciiStringOrClassId(reader);
    return { name: name, classID: classID, keyID: keyID };
}
var unitsMap = {
    '#Ang': 'Angle',
    '#Rsl': 'Density',
    '#Rlt': 'Distance',
    '#Nne': 'None',
    '#Prc': 'Percent',
    '#Pxl': 'Pixels',
    '#Mlm': 'Millimeters',
    '#Pnt': 'Points',
};
function readUnitDoubleStructure(reader) {
    var units = psdReader_1.readSignature(reader);
    var value = psdReader_1.readFloat64(reader);
    return { units: unitsMap[units], value: value };
}
function readUnitFloatStructure(reader) {
    var units = psdReader_1.readSignature(reader);
    var value = psdReader_1.readFloat32(reader);
    return { units: unitsMap[units], value: value };
}
function readClassStructure(reader) {
    var name = psdReader_1.readUnicodeString(reader);
    var classID = readAsciiStringOrClassId(reader);
    return { name: name, classID: classID };
}
function writeClassStructure(writer, name, classID) {
    psdWriter_1.writeUnicodeStringWithPadding(writer, name);
    writeAsciiStringOrClassId(writer, classID);
}
function readEnumeratedReference(reader) {
    var _a = readClassStructure(reader), name = _a.name, classID = _a.classID;
    var TypeID = readAsciiStringOrClassId(reader);
    var value = readAsciiStringOrClassId(reader);
    return { name: name, classID: classID, TypeID: TypeID, value: value };
}
function readOffsetStructure(reader) {
    var _a = readClassStructure(reader), name = _a.name, classID = _a.classID;
    var value = psdReader_1.readUint32(reader);
    return { name: name, classID: classID, value: value };
}
function readAliasStructure(reader) {
    var length = psdReader_1.readInt32(reader);
    return psdReader_1.readAsciiString(reader, length);
}
function readListStructure(reader) {
    var length = psdReader_1.readInt32(reader);
    var type = psdReader_1.readSignature(reader);
    var items = [];
    for (var i = 0; i < length; i++) {
        items.push(readOSType(reader, type));
    }
    return items;
}
function readLargeInteger(reader) {
    var low = psdReader_1.readUint32(reader);
    var high = psdReader_1.readUint32(reader);
    return { low: low, high: high };
}
function readEnumerated(reader) {
    var type = readAsciiStringOrClassId(reader);
    var value = readAsciiStringOrClassId(reader);
    return type + "." + value;
}
function writeEnumerated(writer, full) {
    var _a = full.split('.'), type = _a[0], value = _a[1];
    writeAsciiStringOrClassId(writer, type);
    writeAsciiStringOrClassId(writer, value);
}
function readRawData(reader) {
    var length = psdReader_1.readInt32(reader);
    return psdReader_1.readBytes(reader, length);
}
function writeRawData(writer, value) {
    psdWriter_1.writeInt32(writer, value.byteLength);
    psdWriter_1.writeBytes(writer, value);
}
function readFilePath(reader) {
    var length = psdReader_1.readInt32(reader);
    var sig = psdReader_1.readSignature(reader);
    var pathSize = psdReader_1.readInt32LE(reader);
    var charsCount = psdReader_1.readInt32LE(reader);
    var path = psdReader_1.readUnicodeStringWithLength(reader, charsCount);
    length;
    pathSize;
    return { sig: sig, path: path };
}


},{"./psdReader":8,"./psdWriter":9}],3:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var helpers_1 = require("./helpers");
var psdReader_1 = require("./psdReader");
function readBlendMode(reader) {
    psdReader_1.checkSignature(reader, '8BIM');
    return psdReader_1.readSignature(reader);
}
function readShadowInfo(reader) {
    var size = psdReader_1.readUint32(reader);
    var version = psdReader_1.readUint32(reader);
    if (size !== 41 && size !== 51)
        throw new Error("Invalid effects shadow info size: " + size);
    if (version !== 0 && version !== 2)
        throw new Error("Invalid effects shadow info version: " + version);
    var blur = psdReader_1.readInt32(reader);
    var intensity = psdReader_1.readInt32(reader);
    var angle = psdReader_1.readInt32(reader);
    var distance = psdReader_1.readInt32(reader);
    var color = helpers_1.readColor(reader);
    var blendMode = readBlendMode(reader);
    var enabled = !!psdReader_1.readUint8(reader);
    var useAngleInAllEffects = !!psdReader_1.readUint8(reader);
    var opacity = psdReader_1.readUint8(reader);
    var nativeColor = size >= 51 ? helpers_1.readColor(reader) : undefined;
    return { blur: blur, intensity: intensity, angle: angle, distance: distance, color: color, blendMode: blendMode, enabled: enabled, useAngleInAllEffects: useAngleInAllEffects, opacity: opacity, nativeColor: nativeColor };
}
function readOuterGlowInfo(reader) {
    var size = psdReader_1.readUint32(reader);
    var version = psdReader_1.readUint32(reader);
    if (size !== 32 && size !== 42)
        throw new Error("Invalid effects outer glow info size: " + size);
    if (version !== 0 && version !== 2)
        throw new Error("Invalid effects outer glow info version: " + version);
    var blur = psdReader_1.readUint32(reader);
    var intensity = psdReader_1.readUint32(reader);
    var color = helpers_1.readColor(reader);
    var blendMode = readBlendMode(reader);
    var enabled = !!psdReader_1.readUint8(reader);
    var opacity = psdReader_1.readUint8(reader);
    var nativeColor = size >= 42 ? helpers_1.readColor(reader) : undefined;
    return { blur: blur, intensity: intensity, color: color, blendMode: blendMode, enabled: enabled, opacity: opacity, nativeColor: nativeColor };
}
function readInnerGlowInfo(reader) {
    var size = psdReader_1.readUint32(reader);
    var version = psdReader_1.readUint32(reader);
    if (size !== 33 && size !== 43)
        throw new Error("Invalid effects inner glow info size: " + size);
    if (version !== 0 && version !== 2)
        throw new Error("Invalid effects inner glow info version: " + version);
    var blur = psdReader_1.readUint32(reader);
    var intensity = psdReader_1.readUint32(reader);
    var color = helpers_1.readColor(reader);
    var blendMode = readBlendMode(reader);
    var enabled = !!psdReader_1.readUint8(reader);
    var opacity = psdReader_1.readUint8(reader);
    var invert = size >= 43 ? !!psdReader_1.readUint8(reader) : undefined;
    var nativeColor = size >= 43 ? helpers_1.readColor(reader) : undefined;
    return { blur: blur, intensity: intensity, color: color, blendMode: blendMode, enabled: enabled, opacity: opacity, invert: invert, nativeColor: nativeColor };
}
function readBevelInfo(reader) {
    var size = psdReader_1.readUint32(reader);
    var version = psdReader_1.readUint32(reader);
    if (size !== 58 && size !== 78)
        throw new Error("Invalid effects bevel info size: " + size);
    if (version !== 0 && version !== 2)
        throw new Error("Invalid effects bevel info version: " + version);
    var angle = psdReader_1.readUint32(reader);
    var strength = psdReader_1.readUint32(reader);
    var blur = psdReader_1.readUint32(reader);
    var highlightBlendMode = readBlendMode(reader);
    var shadowBlendMode = readBlendMode(reader);
    var highlightColor = helpers_1.readColor(reader);
    var shadowColor = helpers_1.readColor(reader);
    var bevelStyle = psdReader_1.readUint8(reader);
    var highlightOpacity = psdReader_1.readUint8(reader);
    var shadowOpacity = psdReader_1.readUint8(reader);
    var enabled = !!psdReader_1.readUint8(reader);
    var useAngleInAllEffects = !!psdReader_1.readUint8(reader);
    var up = !!psdReader_1.readUint8(reader);
    var realHighlightColor = size >= 78 ? helpers_1.readColor(reader) : undefined;
    var realShadowColor = size >= 78 ? helpers_1.readColor(reader) : undefined;
    return {
        angle: angle, strength: strength, blur: blur, highlightBlendMode: highlightBlendMode, shadowBlendMode: shadowBlendMode, highlightColor: highlightColor, shadowColor: shadowColor,
        bevelStyle: bevelStyle, highlightOpacity: highlightOpacity, shadowOpacity: shadowOpacity, enabled: enabled, useAngleInAllEffects: useAngleInAllEffects, up: up,
        realHighlightColor: realHighlightColor, realShadowColor: realShadowColor
    };
}
function readSolidFillInfo(reader) {
    var size = psdReader_1.readUint32(reader);
    var version = psdReader_1.readUint32(reader);
    if (size !== 34)
        throw new Error("Invalid effects solid fill info size: " + size);
    if (version !== 2)
        throw new Error("Invalid effects solid fill info version: " + version);
    var blendMode = readBlendMode(reader);
    var color = helpers_1.readColor(reader);
    var opacity = psdReader_1.readUint8(reader);
    var enabled = !!psdReader_1.readUint8(reader);
    var nativeColor = helpers_1.readColor(reader);
    return { blendMode: blendMode, color: color, opacity: opacity, enabled: enabled, nativeColor: nativeColor };
}
function readEffects(reader) {
    var version = psdReader_1.readUint16(reader);
    if (version !== 0)
        throw new Error("Invalid effects layer version: " + version);
    var effectsCount = psdReader_1.readUint16(reader);
    var effects = {};
    for (var i = 0; i < effectsCount; i++) {
        psdReader_1.checkSignature(reader, '8BIM');
        var type = psdReader_1.readSignature(reader);
        switch (type) {
            case 'cmnS': // common state (see See Effects layer, common state info)
                var size = psdReader_1.readUint32(reader);
                var version_1 = psdReader_1.readUint32(reader);
                var visible = !!psdReader_1.readUint8(reader);
                psdReader_1.skipBytes(reader, 2);
                if (size !== 7 || version_1 !== 0 || !visible)
                    throw new Error("Invalid effects common state");
                break;
            case 'dsdw': // drop shadow (see See Effects layer, drop shadow and inner shadow info)
                effects.dropShadow = readShadowInfo(reader);
                break;
            case 'isdw': // inner shadow (see See Effects layer, drop shadow and inner shadow info)
                effects.innerShadow = readShadowInfo(reader);
                break;
            case 'oglw': // outer glow (see See Effects layer, outer glow info)
                effects.outerGlow = readOuterGlowInfo(reader);
                break;
            case 'iglw': // inner glow (see See Effects layer, inner glow info)
                effects.innerGlow = readInnerGlowInfo(reader);
                break;
            case 'bevl': // bevel (see See Effects layer, bevel info)
                effects.bevel = readBevelInfo(reader);
                break;
            case 'sofi': // solid fill ( Photoshop 7.0) (see See Effects layer, solid fill (added in Photoshop 7.0))
                effects.solidFill = readSolidFillInfo(reader);
                break;
            default:
                throw new Error("Invalid effect type: '" + type + "'");
        }
    }
    return effects;
}
exports.readEffects = readEffects;
function writeEffects(_writer, _effects) {
    throw new Error('Not implemented');
}
exports.writeEffects = writeEffects;


},{"./helpers":4,"./psdReader":8}],4:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var psdReader_1 = require("./psdReader");
var base64_js_1 = require("base64-js");
function offsetForChannel(channelId) {
    switch (channelId) {
        case 0 /* Red */: return 0;
        case 1 /* Green */: return 1;
        case 2 /* Blue */: return 2;
        case -1 /* Transparency */: return 3;
        default: return channelId + 1;
    }
}
exports.offsetForChannel = offsetForChannel;
function toArray(value) {
    var result = new Array(value.length);
    for (var i = 0; i < value.length; i++) {
        result[i] = value[i];
    }
    return result;
}
exports.toArray = toArray;
function readColor(reader) {
    return toArray(psdReader_1.readBytes(reader, 10));
}
exports.readColor = readColor;
function hasAlpha(data) {
    var size = data.width * data.height * 4;
    for (var i = 3; i < size; i += 4) {
        if (data.data[i] !== 255) {
            return true;
        }
    }
    return false;
}
exports.hasAlpha = hasAlpha;
function isRowEmpty(_a, y, left, right) {
    var data = _a.data, width = _a.width;
    var start = ((y * width + left) * 4 + 3) | 0;
    var end = (start + (right - left) * 4) | 0;
    for (var i = start; i < end; i = (i + 4) | 0) {
        if (data[i] !== 0) {
            return false;
        }
    }
    return true;
}
function isColEmpty(_a, x, top, bottom) {
    var data = _a.data, width = _a.width;
    var stride = (width * 4) | 0;
    var start = (top * stride + x * 4 + 3) | 0;
    for (var y = top, i = start; y < bottom; y++, i = (i + stride) | 0) {
        if (data[i] !== 0) {
            return false;
        }
    }
    return true;
}
function trimData(data) {
    var top = 0;
    var left = 0;
    var right = data.width;
    var bottom = data.height;
    while (top < bottom && isRowEmpty(data, top, left, right))
        top++;
    while (bottom > top && isRowEmpty(data, bottom - 1, left, right))
        bottom--;
    while (left < right && isColEmpty(data, left, top, bottom))
        left++;
    while (right > left && isColEmpty(data, right - 1, top, bottom))
        right--;
    return { top: top, left: left, right: right, bottom: bottom };
}
function getLayerDimentions(_a) {
    var canvas = _a.canvas;
    if (canvas && canvas.width && canvas.height) {
        return { width: canvas.width, height: canvas.height };
    }
    else {
        return { width: 0, height: 0 };
    }
}
exports.getLayerDimentions = getLayerDimentions;
function getChannels(tempBuffer, layer, background, options) {
    var layerData = getLayerChannels(tempBuffer, layer, background, options);
    var mask = layer.mask;
    if (mask && mask.canvas) {
        var _a = mask.top, top_1 = _a === void 0 ? 0 : _a, _b = mask.left, left = _b === void 0 ? 0 : _b, _c = mask.right, right = _c === void 0 ? 0 : _c, _d = mask.bottom, bottom = _d === void 0 ? 0 : _d;
        var _e = getLayerDimentions(mask), width = _e.width, height = _e.height;
        if (width && height) {
            right = left + width;
            bottom = top_1 + height;
            var context_1 = mask.canvas.getContext('2d');
            var data = context_1.getImageData(0, 0, width, height);
            var buffer = writeDataRLE(tempBuffer, data, width, height, [0]);
            layerData.mask = { top: top_1, left: left, right: right, bottom: bottom };
            layerData.channels.push({
                channelId: -2 /* UserMask */,
                compression: 1 /* RleCompressed */,
                buffer: buffer,
                length: 2 + buffer.length,
            });
        }
    }
    return layerData;
}
exports.getChannels = getChannels;
function getLayerChannels(tempBuffer, layer, background, options) {
    var canvas = layer.canvas;
    var _a = layer.top, top = _a === void 0 ? 0 : _a, _b = layer.left, left = _b === void 0 ? 0 : _b, _c = layer.right, right = _c === void 0 ? 0 : _c, _d = layer.bottom, bottom = _d === void 0 ? 0 : _d;
    var channels = [
        {
            channelId: -1 /* Transparency */,
            compression: 0 /* RawData */,
            buffer: undefined,
            length: 2,
        }
    ];
    var _e = getLayerDimentions(layer), width = _e.width, height = _e.height;
    if (!canvas || !width || !height) {
        right = left;
        bottom = top;
        return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
    }
    right = left + width;
    bottom = top + height;
    var context = canvas.getContext('2d');
    var data = context.getImageData(0, 0, width, height);
    if (options.trimImageData) {
        var trimmed = trimData(data);
        if (trimmed.left !== 0 || trimmed.top !== 0 || trimmed.right !== data.width || trimmed.bottom !== data.height) {
            left += trimmed.left;
            top += trimmed.top;
            right -= (data.width - trimmed.right);
            bottom -= (data.height - trimmed.bottom);
            width = right - left;
            height = bottom - top;
            if (!width || !height) {
                return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
            }
            data = context.getImageData(trimmed.left, trimmed.top, width, height);
        }
    }
    var channelIds = [
        0 /* Red */,
        1 /* Green */,
        2 /* Blue */,
    ];
    if (!background || hasAlpha(data) || layer.mask) {
        channelIds.unshift(-1 /* Transparency */);
    }
    channels = channelIds.map(function (channel) {
        var offset = offsetForChannel(channel);
        var buffer = writeDataRLE(tempBuffer, data, width, height, [offset]);
        return {
            channelId: channel,
            compression: 1 /* RleCompressed */,
            buffer: buffer,
            length: 2 + buffer.length,
        };
    });
    return { layer: layer, top: top, left: left, right: right, bottom: bottom, channels: channels };
}
exports.getLayerChannels = getLayerChannels;
function resetCanvas(_a) {
    var width = _a.width, height = _a.height, data = _a.data;
    var size = (width * height) | 0;
    var buffer = new Uint32Array(data.buffer);
    for (var p = 0; p < size; p = (p + 1) | 0) {
        buffer[p] = 0xff000000;
    }
}
exports.resetCanvas = resetCanvas;
function decodeBitmap(input, output, width, height) {
    for (var y = 0, p = 0, o = 0; y < height; y++) {
        for (var x = 0; x < width;) {
            var b = input[o++];
            for (var i = 0; i < 8 && x < width; i++, x++) {
                var v = b & 0x80 ? 0 : 255;
                b = b << 1;
                output[p++] = v;
                output[p++] = v;
                output[p++] = v;
                output[p++] = 255;
            }
        }
    }
}
exports.decodeBitmap = decodeBitmap;
function writeDataRaw(data, offset, width, height) {
    if (!width || !height)
        return undefined;
    var array = new Uint8Array(width * height);
    for (var i = 0; i < array.length; i++) {
        array[i] = data.data[i * 4 + offset];
    }
    return array;
}
exports.writeDataRaw = writeDataRaw;
function readDataRaw(reader, pixelData, offset, width, height) {
    var size = width * height;
    var buffer = psdReader_1.readBytes(reader, size);
    if (pixelData && offset < 4) {
        var data = pixelData.data;
        for (var i = 0, p = offset | 0; i < size; i++, p = (p + 4) | 0) {
            data[p] = buffer[i];
        }
    }
}
exports.readDataRaw = readDataRaw;
function writeDataRLE(buffer, _a, width, height, offsets) {
    var data = _a.data;
    if (!width || !height)
        return undefined;
    var stride = (4 * width) | 0;
    var ol = 0;
    var o = (offsets.length * 2 * height) | 0;
    for (var _i = 0, offsets_1 = offsets; _i < offsets_1.length; _i++) {
        var offset = offsets_1[_i];
        for (var y = 0, p = offset | 0; y < height; y++) {
            var strideStart = (y * stride) | 0;
            var strideEnd = (strideStart + stride) | 0;
            var lastIndex = (strideEnd + offset - 4) | 0;
            var lastIndex2 = (lastIndex - 4) | 0;
            var startOffset = o;
            for (p = (strideStart + offset) | 0; p < strideEnd; p = (p + 4) | 0) {
                if (p < lastIndex2) {
                    var value1 = data[p];
                    p = (p + 4) | 0;
                    var value2 = data[p];
                    p = (p + 4) | 0;
                    var value3 = data[p];
                    if (value1 === value2 && value1 === value3) {
                        var count = 3;
                        while (count < 128 && p < lastIndex && data[(p + 4) | 0] === value1) {
                            count = (count + 1) | 0;
                            p = (p + 4) | 0;
                        }
                        buffer[o++] = 1 - count;
                        buffer[o++] = value1;
                    }
                    else {
                        var countIndex = o;
                        var writeLast = true;
                        var count = 1;
                        buffer[o++] = 0;
                        buffer[o++] = value1;
                        while (p < lastIndex && count < 128) {
                            p = (p + 4) | 0;
                            value1 = value2;
                            value2 = value3;
                            value3 = data[p];
                            if (value1 === value2 && value1 === value3) {
                                p = (p - 12) | 0;
                                writeLast = false;
                                break;
                            }
                            else {
                                count++;
                                buffer[o++] = value1;
                            }
                        }
                        if (writeLast) {
                            if (count < 127) {
                                buffer[o++] = value2;
                                buffer[o++] = value3;
                                count += 2;
                            }
                            else if (count < 128) {
                                buffer[o++] = value2;
                                count++;
                                p = (p - 4) | 0;
                            }
                            else {
                                p = (p - 8) | 0;
                            }
                        }
                        buffer[countIndex] = count - 1;
                    }
                }
                else if (p === lastIndex) {
                    buffer[o++] = 0;
                    buffer[o++] = data[p];
                }
                else { // p === lastIndex2
                    buffer[o++] = 1;
                    buffer[o++] = data[p];
                    p = (p + 4) | 0;
                    buffer[o++] = data[p];
                }
            }
            var length_1 = o - startOffset;
            buffer[ol++] = (length_1 >> 8) & 0xff;
            buffer[ol++] = length_1 & 0xff;
        }
    }
    return buffer.slice(0, o);
}
exports.writeDataRLE = writeDataRLE;
function readDataRLE(reader, pixelData, _width, height, step, offsets) {
    var lengths = new Uint16Array(offsets.length * height);
    var data = pixelData && pixelData.data;
    for (var o = 0, li = 0; o < offsets.length; o++) {
        for (var y = 0; y < height; y++, li++) {
            lengths[li] = psdReader_1.readUint16(reader);
        }
    }
    for (var c = 0, li = 0; c < offsets.length; c++) {
        var offset = offsets[c] | 0;
        var extra = c > 3 || offset > 3;
        if (!data || extra) {
            for (var y = 0; y < height; y++, li++) {
                psdReader_1.skipBytes(reader, lengths[li]);
            }
        }
        else {
            for (var y = 0, p = offset | 0; y < height; y++, li++) {
                var length_2 = lengths[li];
                var buffer = psdReader_1.readBytes(reader, length_2);
                for (var i = 0; i < length_2; i++) {
                    var header = buffer[i];
                    if (header >= 128) {
                        var value = buffer[++i];
                        header = (256 - header) | 0;
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = value;
                            p = (p + step) | 0;
                        }
                    }
                    else { // header < 128
                        for (var j = 0; j <= header; j = (j + 1) | 0) {
                            data[p] = buffer[++i];
                            p = (p + step) | 0;
                        }
                    }
                    /* istanbul ignore if */
                    if (i >= length_2) {
                        throw new Error("Invalid RLE data: exceeded buffer size " + i + "/" + length_2);
                    }
                }
            }
        }
    }
}
exports.readDataRLE = readDataRLE;
/* istanbul ignore next */
exports.createCanvas = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvas method');
};
/* istanbul ignore next */
exports.createCanvasFromData = function () {
    throw new Error('Canvas not initialized, use initializeCanvas method to set up createCanvasFromData method');
};
/* istanbul ignore if */
if (typeof document !== 'undefined') {
    exports.createCanvas = function (width, height) {
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    };
    exports.createCanvasFromData = function (data) {
        var image = new Image();
        image.src = 'data:image/jpeg;base64,' + base64_js_1.fromByteArray(data);
        var canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return canvas;
    };
}
function initializeCanvas(createCanvasMethod, createCanvasFromDataMethod) {
    exports.createCanvas = createCanvasMethod;
    exports.createCanvasFromData = createCanvasFromDataMethod || exports.createCanvasFromData;
}
exports.initializeCanvas = initializeCanvas;


},{"./psdReader":8,"base64-js":10}],5:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var base64_js_1 = require("base64-js");
var psdReader_1 = require("./psdReader");
var psdWriter_1 = require("./psdWriter");
var helpers_1 = require("./helpers");
var handlers = [];
var handlersMap = {};
function addHandler(key, has, read, write) {
    var handler = { key: key, has: has, read: read, write: write };
    handlers.push(handler);
    handlersMap[handler.key] = handler;
}
function getHandler(key, _name) {
    return handlersMap[key];
}
exports.getHandler = getHandler;
function getHandlers() {
    return handlers;
}
exports.getHandlers = getHandlers;
// 32-bit fixed-point number 16.16
function readFixedPoint32(reader) {
    return psdReader_1.readUint32(reader) / (1 << 16);
}
// 32-bit fixed-point number 16.16
function writeFixedPoint32(writer, value) {
    psdWriter_1.writeUint32(writer, value * (1 << 16));
}
var RESOLUTION_UNITS = [undefined, 'PPI', 'PPCM'];
var MEASUREMENT_UNITS = [undefined, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'];
var hex = '0123456789abcdef';
function charToNibble(code) {
    return code <= 57 ? code - 48 : code - 87;
}
function byteAt(value, index) {
    return (charToNibble(value.charCodeAt(index)) << 4) | charToNibble(value.charCodeAt(index + 1));
}
addHandler(1061, function (target) { return target.captionDigest !== undefined; }, function (reader, target) {
    var captionDigest = '';
    for (var i = 0; i < 16; i++) {
        var byte = psdReader_1.readUint8(reader);
        captionDigest += hex[byte >> 4];
        captionDigest += hex[byte & 0xf];
    }
    target.captionDigest = captionDigest;
}, function (writer, target) {
    for (var i = 0; i < 16; i++) {
        psdWriter_1.writeUint8(writer, byteAt(target.captionDigest, i * 2));
    }
});
// addHandler(
// 	1060,
// 	target => target.xmpMetadata !== undefined,
// 	(reader, target, left) => {
// 		target.xmpMetadata = readUtf8String(reader, left());
// 	},
// 	(writer, target) => {
// 		writeUtf8String(writer, target.xmpMetadata!);
// 	},
// );
// addHandler(
// 	1082,
// 	target => target.printInformation !== undefined,
// 	(reader, target) => {
// 		const descriptorVersion = readInt32(reader);
// 		if (descriptorVersion !== 16) {
// 			throw new Error(`Invalid descriptor version`);
// 		}
// 		const value = readDescriptorStructure(reader);
// 		target.printInformation = {
// 			printerName: value.printerName,
// 		};
// 	},
// 	(writer, target) => {
// 		const value = target.printInformation!;
// 		writeInt32(writer, 16); // descriptor version
// 		writeDescriptorStructure(writer, '', 'printOutput', {
// 			PstS: true,
// 			Inte: 'Inte.Clrm',
// 			printSixteenBit: false,
// 			printerName: value.printerName || '',
// 			printProofSetup: {
// 				Bltn: 'builtinProof.proofCMYK',
// 			},
// 		});
// 	},
// );
// addHandler(
// 	1083,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1083] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1083]); target;
// 	},
// );
addHandler(1005, function (target) { return target.resolutionInfo !== undefined; }, function (reader, target) {
    var horizontalResolution = readFixedPoint32(reader);
    var horizontalResolutionUnit = psdReader_1.readUint16(reader);
    var widthUnit = psdReader_1.readUint16(reader);
    var verticalResolution = readFixedPoint32(reader);
    var verticalResolutionUnit = psdReader_1.readUint16(reader);
    var heightUnit = psdReader_1.readUint16(reader);
    target.resolutionInfo = {
        horizontalResolution: horizontalResolution,
        horizontalResolutionUnit: RESOLUTION_UNITS[horizontalResolutionUnit] || 'PPI',
        widthUnit: MEASUREMENT_UNITS[widthUnit] || 'Inches',
        verticalResolution: verticalResolution,
        verticalResolutionUnit: RESOLUTION_UNITS[verticalResolutionUnit] || 'PPI',
        heightUnit: MEASUREMENT_UNITS[heightUnit] || 'Inches',
    };
}, function (writer, target) {
    var info = target.resolutionInfo;
    writeFixedPoint32(writer, info.horizontalResolution || 0);
    psdWriter_1.writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.horizontalResolutionUnit)));
    psdWriter_1.writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.widthUnit)));
    writeFixedPoint32(writer, info.verticalResolution || 0);
    psdWriter_1.writeUint16(writer, Math.max(1, RESOLUTION_UNITS.indexOf(info.verticalResolutionUnit)));
    psdWriter_1.writeUint16(writer, Math.max(1, MEASUREMENT_UNITS.indexOf(info.heightUnit)));
});
var printScaleStyles = ['centered', 'size to fit', 'user defined'];
addHandler(1062, function (target) { return target.printScale !== undefined; }, function (reader, target) {
    target.printScale = {
        style: printScaleStyles[psdReader_1.readInt16(reader)],
        x: psdReader_1.readFloat32(reader),
        y: psdReader_1.readFloat32(reader),
        scale: psdReader_1.readFloat32(reader),
    };
}, function (writer, target) {
    var _a = target.printScale, style = _a.style, x = _a.x, y = _a.y, scale = _a.scale;
    psdWriter_1.writeInt16(writer, Math.max(0, printScaleStyles.indexOf(style)));
    psdWriter_1.writeFloat32(writer, x || 0);
    psdWriter_1.writeFloat32(writer, y || 0);
    psdWriter_1.writeFloat32(writer, scale || 0);
});
addHandler(1006, function (target) { return target.alphaChannelNames !== undefined; }, function (reader, target, left) {
    target.alphaChannelNames = [];
    while (left()) {
        target.alphaChannelNames.push(psdReader_1.readPascalString(reader, 1));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaChannelNames; _i < _a.length; _i++) {
        var name_1 = _a[_i];
        psdWriter_1.writePascalString(writer, name_1);
    }
});
addHandler(1037, function (target) { return target.globalAngle !== undefined; }, function (reader, target) {
    target.globalAngle = psdReader_1.readUint32(reader);
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.globalAngle);
});
addHandler(1049, function (target) { return target.globalAltitude !== undefined; }, function (reader, target) {
    target.globalAltitude = psdReader_1.readUint32(reader);
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.globalAltitude);
});
// addHandler(
// 	1011,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1011] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1011]); target;
// 	},
// );
// addHandler(
// 	10000,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[10000] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[10000]); target;
// 	},
// );
// addHandler(
// 	1013,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1013] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1013]); target;
// 	},
// );
// addHandler(
// 	1016,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1016] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1016]); target;
// 	},
// );
addHandler(1024, function (target) { return target.layerState !== undefined; }, function (reader, target) {
    target.layerState = psdReader_1.readUint16(reader);
}, function (writer, target) {
    psdWriter_1.writeUint16(writer, target.layerState);
});
addHandler(1026, function (target) { return target.layersGroup !== undefined; }, function (reader, target, left) {
    target.layersGroup = [];
    while (left()) {
        target.layersGroup.push(psdReader_1.readUint16(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layersGroup; _i < _a.length; _i++) {
        var g = _a[_i];
        psdWriter_1.writeUint16(writer, g);
    }
});
addHandler(1072, function (target) { return target.layerGroupsEnabledId !== undefined; }, function (reader, target, left) {
    target.layerGroupsEnabledId = [];
    while (left()) {
        target.layerGroupsEnabledId.push(psdReader_1.readUint8(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.layerGroupsEnabledId; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint8(writer, id);
    }
});
addHandler(1069, function (target) { return target.layerSelectionIds !== undefined; }, function (reader, target) {
    var count = psdReader_1.readUint16(reader);
    target.layerSelectionIds = [];
    while (count--) {
        target.layerSelectionIds.push(psdReader_1.readUint32(reader));
    }
}, function (writer, target) {
    psdWriter_1.writeUint16(writer, target.layerSelectionIds.length);
    for (var _i = 0, _a = target.layerSelectionIds; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint32(writer, id);
    }
});
addHandler(1032, function (target) { return target.gridAndGuidesInformation !== undefined; }, function (reader, target) {
    target.gridAndGuidesInformation = {
        version: psdReader_1.readUint32(reader),
        grid: {
            horizontal: psdReader_1.readUint32(reader),
            vertical: psdReader_1.readUint32(reader),
        },
        guides: [],
    };
    var count = psdReader_1.readUint32(reader);
    while (count--) {
        target.gridAndGuidesInformation.guides.push({
            location: psdReader_1.readUint32(reader) / 32,
            direction: psdReader_1.readUint8(reader) ? 'horizontal' : 'vertical'
        });
    }
}, function (writer, target) {
    var info = target.gridAndGuidesInformation;
    var version = info.version || 1;
    var grid = info.grid || { horizontal: 18 * 32, vertical: 18 * 32 };
    var guides = info.guides || [];
    psdWriter_1.writeUint32(writer, version);
    psdWriter_1.writeUint32(writer, grid.horizontal);
    psdWriter_1.writeUint32(writer, grid.vertical);
    psdWriter_1.writeUint32(writer, guides.length);
    guides.forEach(function (g) {
        psdWriter_1.writeUint32(writer, g.location * 32);
        psdWriter_1.writeUint8(writer, g.direction === 'horizontal' ? 1 : 0);
    });
});
addHandler(1045, function (target) { return target.unicodeAlphaNames !== undefined; }, function (reader, target, left) {
    target.unicodeAlphaNames = [];
    while (left()) {
        target.unicodeAlphaNames.push(psdReader_1.readUnicodeString(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.unicodeAlphaNames; _i < _a.length; _i++) {
        var name_2 = _a[_i];
        psdWriter_1.writeUnicodeString(writer, name_2);
    }
});
addHandler(1053, function (target) { return target.alphaIdentifiers !== undefined; }, function (reader, target, left) {
    target.alphaIdentifiers = [];
    while (left() >= 4) {
        target.alphaIdentifiers.push(psdReader_1.readUint32(reader));
    }
}, function (writer, target) {
    for (var _i = 0, _a = target.alphaIdentifiers; _i < _a.length; _i++) {
        var id = _a[_i];
        psdWriter_1.writeUint32(writer, id);
    }
});
addHandler(1054, function (target) { return target.urlsList !== undefined; }, function (reader, target, _, options) {
    var count = psdReader_1.readUint32(reader);
    if (count) {
        if (!options.throwForMissingFeatures)
            return;
        throw new Error('Not implemented: URL List');
    }
    target.urlsList = [];
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.urlsList.length);
    if (target.urlsList.length)
        throw new Error('Not implemented: URL List');
});
// addHandler(
// 	1050,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1050] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1050]); target;
// 	},
// );
addHandler(1064, function (target) { return target.pixelAspectRatio !== undefined; }, function (reader, target) {
    target.pixelAspectRatio = {
        version: psdReader_1.readUint32(reader),
        aspect: psdReader_1.readFloat64(reader),
    };
}, function (writer, target) {
    psdWriter_1.writeUint32(writer, target.pixelAspectRatio.version);
    psdWriter_1.writeFloat64(writer, target.pixelAspectRatio.aspect);
});
// addHandler(
// 	1039,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1039] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1039]); target;
// 	},
// );
// addHandler(
// 	1044,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1044] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1044]); target;
// 	},
// );
addHandler(1036, function (target) { return target.thumbnail !== undefined; }, function (reader, target, left) {
    var format = psdReader_1.readUint32(reader); // 1 = kJpegRGB, 0 = kRawRGB
    var width = psdReader_1.readUint32(reader);
    var height = psdReader_1.readUint32(reader);
    var widthBytes = psdReader_1.readUint32(reader); // = (width * bits_per_pixel + 31) / 32 * 4.
    var totalSize = psdReader_1.readUint32(reader); // = widthBytes * height * planes
    var sizeAfterCompression = psdReader_1.readUint32(reader);
    var bitsPerPixel = psdReader_1.readUint16(reader); // 24
    var planes = psdReader_1.readUint16(reader); // 1
    if (format !== 1 || bitsPerPixel !== 24 || planes !== 1) {
        console.log("invalid thumbnail data (format: " + format + ", bitsPerPixel: " + bitsPerPixel + ", planes: " + planes + ")");
        psdReader_1.skipBytes(reader, left());
        return;
    }
    width;
    height;
    widthBytes;
    totalSize;
    sizeAfterCompression;
    var size = left();
    var bytes = psdReader_1.readBytes(reader, size);
    target.thumbnail = helpers_1.createCanvasFromData(bytes);
}, function (writer, target) {
    var thumb = target.thumbnail;
    var data = base64_js_1.toByteArray(thumb.toDataURL('image/jpeg', 1).substr('data:image/jpeg;base64,'.length));
    var bitsPerPixel = 24;
    var widthBytes = (thumb.width * bitsPerPixel + 31) / 32 * 4;
    var planes = 1;
    var totalSize = widthBytes * thumb.height * planes;
    var sizeAfterCompression = data.length;
    psdWriter_1.writeUint32(writer, 1); // 1 = kJpegRGB
    psdWriter_1.writeUint32(writer, thumb.width);
    psdWriter_1.writeUint32(writer, thumb.height);
    psdWriter_1.writeUint32(writer, widthBytes);
    psdWriter_1.writeUint32(writer, totalSize);
    psdWriter_1.writeUint32(writer, sizeAfterCompression);
    psdWriter_1.writeUint16(writer, bitsPerPixel);
    psdWriter_1.writeUint16(writer, planes);
    psdWriter_1.writeBytes(writer, data);
});
addHandler(1057, function (target) { return target.versionInfo !== undefined; }, function (reader, target, left) {
    target.versionInfo = {
        version: psdReader_1.readUint32(reader),
        hasRealMergedData: !!psdReader_1.readUint8(reader),
        writerName: psdReader_1.readUnicodeString(reader),
        readerName: psdReader_1.readUnicodeString(reader),
        fileVersion: psdReader_1.readUint32(reader),
    };
    psdReader_1.skipBytes(reader, left());
}, function (writer, target) {
    var versionInfo = target.versionInfo;
    psdWriter_1.writeUint32(writer, versionInfo.version);
    psdWriter_1.writeUint8(writer, versionInfo.hasRealMergedData ? 1 : 0);
    psdWriter_1.writeUnicodeString(writer, versionInfo.writerName);
    psdWriter_1.writeUnicodeString(writer, versionInfo.readerName);
    psdWriter_1.writeUint32(writer, versionInfo.fileVersion);
});
// addHandler(
// 	1058,
// 	target => !!target,
// 	(reader, target, left) => {
// 		__data[1058] = readBytes(reader, left()); target;
// 	},
// 	(writer, target) => {
// 		writeBytes(writer, __data[1058]); target;
// 	},
// );


},{"./helpers":4,"./psdReader":8,"./psdWriter":9,"base64-js":10}],6:[function(require,module,exports){
(function (Buffer){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var psdWriter_1 = require("./psdWriter");
var psdReader_1 = require("./psdReader");
var helpers_1 = require("./helpers");
exports.initializeCanvas = helpers_1.initializeCanvas;
var psd_1 = require("./psd");
exports.ColorMode = psd_1.ColorMode;
exports.ChannelID = psd_1.ChannelID;
exports.Compression = psd_1.Compression;
exports.SectionDividerType = psd_1.SectionDividerType;
function readPsd(buffer, options) {
    var reader = 'buffer' in buffer ?
        psdReader_1.createReader(buffer.buffer, buffer.byteOffset, buffer.byteLength) :
        psdReader_1.createReader(buffer);
    return psdReader_1.readPsd(reader, options);
}
exports.readPsd = readPsd;
function writePsd(psd, options) {
    var writer = psdWriter_1.createWriter();
    psdWriter_1.writePsd(writer, psd, options);
    return psdWriter_1.getWriterBuffer(writer);
}
exports.writePsd = writePsd;
function writePsdBuffer(psd, options) {
    if (typeof Buffer === 'undefined') {
        throw new Error('Buffer not supported on this platform');
    }
    return new Buffer(writePsd(psd, options));
}
exports.writePsdBuffer = writePsdBuffer;


}).call(this,require("buffer").Buffer)
},{"./helpers":4,"./psd":7,"./psdReader":8,"./psdWriter":9,"buffer":11}],7:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromBlendMode = {};
exports.toBlendMode = {
    'pass': 'pass through',
    'norm': 'normal',
    'diss': 'dissolve',
    'dark': 'darken',
    'mul ': 'multiply',
    'idiv': 'color burn',
    'lbrn': 'linear burn',
    'dkCl': 'darker color',
    'lite': 'lighten',
    'scrn': 'screen',
    'div ': 'color dodge',
    'lddg': 'linear dodge',
    'lgCl': 'lighter color',
    'over': 'overlay',
    'sLit': 'soft light',
    'hLit': 'hard light',
    'vLit': 'vivid light',
    'lLit': 'linear light',
    'pLit': 'pin light',
    'hMix': 'hard mix',
    'diff': 'difference',
    'smud': 'exclusion',
    'fsub': 'subtract',
    'fdiv': 'divide',
    'hue ': 'hue',
    'sat ': 'saturation',
    'colr': 'color',
    'lum ': 'luminosity',
};
Object.keys(exports.toBlendMode).forEach(function (key) { return exports.fromBlendMode[exports.toBlendMode[key]] = key; });
// export const enum ColorSpace {
// 	RGB = 0,
// 	HSB = 1,
// 	CMYK = 2,
// 	Lab = 7,
// 	Grayscale = 8,
// }
var ColorMode;
(function (ColorMode) {
    ColorMode[ColorMode["Bitmap"] = 0] = "Bitmap";
    ColorMode[ColorMode["Grayscale"] = 1] = "Grayscale";
    ColorMode[ColorMode["Indexed"] = 2] = "Indexed";
    ColorMode[ColorMode["RGB"] = 3] = "RGB";
    ColorMode[ColorMode["CMYK"] = 4] = "CMYK";
    ColorMode[ColorMode["Multichannel"] = 7] = "Multichannel";
    ColorMode[ColorMode["Duotone"] = 8] = "Duotone";
    ColorMode[ColorMode["Lab"] = 9] = "Lab";
})(ColorMode = exports.ColorMode || (exports.ColorMode = {}));
var ChannelID;
(function (ChannelID) {
    ChannelID[ChannelID["Red"] = 0] = "Red";
    ChannelID[ChannelID["Green"] = 1] = "Green";
    ChannelID[ChannelID["Blue"] = 2] = "Blue";
    ChannelID[ChannelID["Transparency"] = -1] = "Transparency";
    ChannelID[ChannelID["UserMask"] = -2] = "UserMask";
    ChannelID[ChannelID["RealUserMask"] = -3] = "RealUserMask";
})(ChannelID = exports.ChannelID || (exports.ChannelID = {}));
var Compression;
(function (Compression) {
    Compression[Compression["RawData"] = 0] = "RawData";
    Compression[Compression["RleCompressed"] = 1] = "RleCompressed";
    Compression[Compression["ZipWithoutPrediction"] = 2] = "ZipWithoutPrediction";
    Compression[Compression["ZipWithPrediction"] = 3] = "ZipWithPrediction";
})(Compression = exports.Compression || (exports.Compression = {}));
var SectionDividerType;
(function (SectionDividerType) {
    SectionDividerType[SectionDividerType["Other"] = 0] = "Other";
    SectionDividerType[SectionDividerType["OpenFolder"] = 1] = "OpenFolder";
    SectionDividerType[SectionDividerType["ClosedFolder"] = 2] = "ClosedFolder";
    SectionDividerType[SectionDividerType["BoundingSectionDivider"] = 3] = "BoundingSectionDivider";
})(SectionDividerType = exports.SectionDividerType || (exports.SectionDividerType = {}));
var LayerMaskFlags;
(function (LayerMaskFlags) {
    LayerMaskFlags[LayerMaskFlags["PositionRelativeToLayer"] = 1] = "PositionRelativeToLayer";
    LayerMaskFlags[LayerMaskFlags["LayerMaskDisabled"] = 2] = "LayerMaskDisabled";
    LayerMaskFlags[LayerMaskFlags["InvertLayerMaskWhenBlending"] = 4] = "InvertLayerMaskWhenBlending";
    LayerMaskFlags[LayerMaskFlags["LayerMaskFromRenderingOtherData"] = 8] = "LayerMaskFromRenderingOtherData";
    LayerMaskFlags[LayerMaskFlags["MaskHasParametersAppliedToIt"] = 16] = "MaskHasParametersAppliedToIt";
})(LayerMaskFlags = exports.LayerMaskFlags || (exports.LayerMaskFlags = {}));
var MaskParameters;
(function (MaskParameters) {
    MaskParameters[MaskParameters["UserMaskDensity"] = 1] = "UserMaskDensity";
    MaskParameters[MaskParameters["UserMaskFeather"] = 2] = "UserMaskFeather";
    MaskParameters[MaskParameters["VectorMaskDensity"] = 4] = "VectorMaskDensity";
    MaskParameters[MaskParameters["VectorMaskFeather"] = 8] = "VectorMaskFeather";
})(MaskParameters = exports.MaskParameters || (exports.MaskParameters = {}));


},{}],8:[function(require,module,exports){
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var psd_1 = require("./psd");
var helpers_1 = require("./helpers");
var additionalInfo_1 = require("./additionalInfo");
var imageResources_1 = require("./imageResources");
var supportedColorModes = [0 /* Bitmap */, 1 /* Grayscale */, 3 /* RGB */];
function setupGrayscale(data) {
    var size = data.width * data.height * 4;
    for (var i = 0; i < size; i += 4) {
        data.data[i + 1] = data.data[i];
        data.data[i + 2] = data.data[i];
    }
}
function createReader(buffer, offset, length) {
    var view = new DataView(buffer, offset, length);
    return { view: view, offset: 0 };
}
exports.createReader = createReader;
function readUint8(reader) {
    reader.offset += 1;
    return reader.view.getUint8(reader.offset - 1);
}
exports.readUint8 = readUint8;
function peekUint8(reader) {
    return reader.view.getUint8(reader.offset);
}
exports.peekUint8 = peekUint8;
function readInt16(reader) {
    reader.offset += 2;
    return reader.view.getInt16(reader.offset - 2, false);
}
exports.readInt16 = readInt16;
function readUint16(reader) {
    reader.offset += 2;
    return reader.view.getUint16(reader.offset - 2, false);
}
exports.readUint16 = readUint16;
function readInt32(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, false);
}
exports.readInt32 = readInt32;
function readInt32LE(reader) {
    reader.offset += 4;
    return reader.view.getInt32(reader.offset - 4, true);
}
exports.readInt32LE = readInt32LE;
function readUint32(reader) {
    reader.offset += 4;
    return reader.view.getUint32(reader.offset - 4, false);
}
exports.readUint32 = readUint32;
function readFloat32(reader) {
    reader.offset += 4;
    return reader.view.getFloat32(reader.offset - 4, false);
}
exports.readFloat32 = readFloat32;
function readFloat64(reader) {
    reader.offset += 8;
    return reader.view.getFloat64(reader.offset - 8, false);
}
exports.readFloat64 = readFloat64;
function readBytes(reader, length) {
    reader.offset += length;
    return new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset - length, length);
}
exports.readBytes = readBytes;
function readSignature(reader) {
    return readShortString(reader, 4);
}
exports.readSignature = readSignature;
function readPascalString(reader, padTo) {
    if (padTo === void 0) { padTo = 2; }
    var length = readUint8(reader);
    var text = readShortString(reader, length);
    while (++length % padTo) {
        skipBytes(reader, 1);
    }
    return text;
}
exports.readPascalString = readPascalString;
function readUnicodeString(reader) {
    var length = readUint32(reader);
    return readUnicodeStringWithLength(reader, length);
}
exports.readUnicodeString = readUnicodeString;
function readUnicodeStringWithLength(reader, length) {
    var text = '';
    while (length--) {
        var value = readUint16(reader);
        if (value || length > 0) { // remove trailing \0
            text += String.fromCharCode(value);
        }
    }
    return text;
}
exports.readUnicodeStringWithLength = readUnicodeStringWithLength;
function readAsciiString(reader, length) {
    var text = '';
    while (length--) {
        text += String.fromCharCode(readUint8(reader));
    }
    return text;
}
exports.readAsciiString = readAsciiString;
// export function readUtf8String(reader: PsdReader, length: number) {
// 	const buffer = readBytes(reader, length);
// 	return decodeString(buffer);
// }
function skipBytes(reader, count) {
    reader.offset += count;
}
exports.skipBytes = skipBytes;
function checkSignature(reader) {
    var expected = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        expected[_i - 1] = arguments[_i];
    }
    var offset = reader.offset;
    var signature = readSignature(reader);
    /* istanbul ignore if */
    if (expected.indexOf(signature) === -1) {
        throw new Error("Invalid signature: '" + signature + "' at 0x" + offset.toString(16));
    }
}
exports.checkSignature = checkSignature;
function readShortString(reader, length) {
    var buffer = readBytes(reader, length);
    return String.fromCharCode.apply(String, buffer);
}
function readPsd(reader, options) {
    if (options === void 0) { options = {}; }
    var psd = readHeader(reader);
    readColorModeData(reader, psd, options);
    readImageResources(reader, psd, options);
    var globalAlpha = readLayerAndMaskInfo(reader, psd, options);
    var hasChildren = psd.children && psd.children.length;
    var skipComposite = options.skipCompositeImageData && (options.skipLayerImageData || hasChildren);
    if (!skipComposite) {
        readImageData(reader, psd, globalAlpha);
    }
    return psd;
}
exports.readPsd = readPsd;
function readHeader(reader) {
    checkSignature(reader, '8BPS');
    var version = readUint16(reader);
    /* istanbul ignore if */
    if (version !== 1)
        throw new Error("Invalid PSD file version: " + version);
    skipBytes(reader, 6);
    var channels = readUint16(reader);
    var height = readUint32(reader);
    var width = readUint32(reader);
    var bitsPerChannel = readUint16(reader);
    var colorMode = readUint16(reader);
    /* istanbul ignore if */
    if (supportedColorModes.indexOf(colorMode) === -1)
        throw new Error("Color mode not supported: " + colorMode);
    return { width: width, height: height, channels: channels, bitsPerChannel: bitsPerChannel, colorMode: colorMode };
}
function readColorModeData(reader, _psd, options) {
    readSection(reader, 1, function (left) {
        if (options.throwForMissingFeatures) {
            throw new Error('Not Implemented: color mode data');
        }
        else {
            skipBytes(reader, left());
        }
    });
}
function readImageResources(reader, psd, options) {
    readSection(reader, 1, function (left) {
        while (left()) {
            readImageResource(reader, psd, options);
        }
    });
}
function readImageResource(reader, psd, options) {
    checkSignature(reader, '8BIM');
    var id = readUint16(reader);
    var name = readPascalString(reader);
    readSection(reader, 2, function (left) {
        var handler = imageResources_1.getHandler(id, name);
        var skip = id === 1036 && !!options.skipThumbnail;
        if (!psd.imageResources) {
            psd.imageResources = {};
        }
        if (handler && !skip) {
            handler.read(reader, psd.imageResources, left, options);
        }
        else {
            // console.log(`Image resource: ${id} ${name} ${getImageResourceName(id).substr(0, 90) }`);
            skipBytes(reader, left());
        }
    });
}
function readLayerAndMaskInfo(reader, psd, options) {
    var globalAlpha = false;
    readSection(reader, 1, function (left) {
        globalAlpha = readLayerInfo(reader, psd, options);
        // SAI does not include this section
        if (left() > 0) {
            readGlobalLayerMaskInfo(reader);
        }
        else {
            // revert back to end of section if exceeded section limits
            skipBytes(reader, left());
        }
        while (left() > 0) {
            // sometimes there are empty bytes here
            while (left() && peekUint8(reader) === 0) {
                skipBytes(reader, 1);
            }
            if (left() >= 12) {
                readAdditionalLayerInfo(reader, psd, !!options.logMissingFeatures);
            }
            else {
                skipBytes(reader, left());
            }
        }
    });
    return globalAlpha;
}
function readLayerInfo(reader, psd, options) {
    var globalAlpha = false;
    readSection(reader, 2, function (left) {
        var layerCount = readInt16(reader);
        if (layerCount < 0) {
            globalAlpha = true;
            layerCount = -layerCount;
        }
        var layers = [];
        var layerChannels = [];
        for (var i = 0; i < layerCount; i++) {
            var _a = readLayerRecord(reader, options), layer = _a.layer, channels = _a.channels;
            layers.push(layer);
            layerChannels.push(channels);
        }
        if (!options.skipLayerImageData) {
            for (var i = 0; i < layerCount; i++) {
                readLayerChannelImageData(reader, psd, layers[i], layerChannels[i], options);
            }
        }
        skipBytes(reader, left());
        if (!psd.children) {
            psd.children = [];
        }
        var stack = [psd];
        for (var i = layers.length - 1; i >= 0; i--) {
            var l = layers[i];
            var type = l.sectionDivider ? l.sectionDivider.type : 0 /* Other */;
            if (type === 1 /* OpenFolder */ || type === 2 /* ClosedFolder */) {
                l.opened = type === 1 /* OpenFolder */;
                l.children = [];
                stack[stack.length - 1].children.unshift(l);
                stack.push(l);
            }
            else if (type === 3 /* BoundingSectionDivider */) {
                stack.pop();
            }
            else {
                stack[stack.length - 1].children.unshift(l);
            }
        }
    });
    return globalAlpha;
}
function readLayerRecord(reader, options) {
    var layer = {};
    layer.top = readInt32(reader);
    layer.left = readInt32(reader);
    layer.bottom = readInt32(reader);
    layer.right = readInt32(reader);
    var channelCount = readUint16(reader);
    var channels = [];
    for (var i = 0; i < channelCount; i++) {
        var channelID = readInt16(reader);
        var channelLength = readInt32(reader);
        channels.push({ id: channelID, length: channelLength });
    }
    checkSignature(reader, '8BIM');
    var blendMode = readSignature(reader);
    /* istanbul ignore if */
    if (!psd_1.toBlendMode[blendMode])
        throw new Error("Invalid blend mode: '" + blendMode + "'");
    layer.blendMode = psd_1.toBlendMode[blendMode];
    layer.opacity = readUint8(reader);
    layer.clipping = readUint8(reader) === 1;
    var flags = readUint8(reader);
    layer.transparencyProtected = (flags & 0x01) !== 0;
    layer.hidden = (flags & 0x02) !== 0;
    skipBytes(reader, 1);
    readSection(reader, 1, function (left) {
        var mask = readLayerMaskData(reader, options);
        if (mask) {
            layer.mask = mask;
        }
        /*const blendingRanges =*/ readLayerBlendingRanges(reader);
        layer.name = readPascalString(reader, 4);
        while (left()) {
            readAdditionalLayerInfo(reader, layer, !!options.logMissingFeatures);
        }
    });
    return { layer: layer, channels: channels };
}
function readLayerMaskData(reader, _options) {
    return readSection(reader, 1, function (bytesLeft) {
        if (bytesLeft()) {
            var mask = {};
            mask.top = readInt32(reader);
            mask.left = readInt32(reader);
            mask.bottom = readInt32(reader);
            mask.right = readInt32(reader);
            mask.defaultColor = readUint8(reader);
            var flags = readUint8(reader);
            mask.disabled = (flags & 2 /* LayerMaskDisabled */) !== 0;
            mask.positionRelativeToLayer = (flags & 1 /* PositionRelativeToLayer */) !== 0;
            // TODO: handle LayerMaskFlags.LayerMaskFromRenderingOtherData
            if (flags & 16 /* MaskHasParametersAppliedToIt */) {
                var parameters = readUint8(reader);
                if (parameters & 1 /* UserMaskDensity */)
                    mask.userMaskDensity = readUint8(reader);
                if (parameters & 2 /* UserMaskFeather */)
                    mask.userMaskFeather = readFloat64(reader);
                if (parameters & 1 /* UserMaskDensity */)
                    mask.vectorMaskDensity = readUint8(reader);
                if (parameters & 2 /* UserMaskFeather */)
                    mask.vectorMaskFeather = readFloat64(reader);
            }
            if (bytesLeft() > 2) {
                // TODO: handle these values
                /*const realFlags =*/ readUint8(reader);
                /*const realUserMaskBackground =*/ readUint8(reader);
                /*const top2 =*/ readInt32(reader);
                /*const left2 =*/ readInt32(reader);
                /*const bottom2 =*/ readInt32(reader);
                /*const right2 =*/ readInt32(reader);
            }
            skipBytes(reader, bytesLeft());
            return mask;
        }
        else {
            return undefined;
        }
    });
}
function readLayerBlendingRanges(reader) {
    return readSection(reader, 1, function (left) {
        var compositeGrayBlendSource = readUint32(reader);
        var compositeGraphBlendDestinationRange = readUint32(reader);
        var ranges = [];
        while (left()) {
            var sourceRange = readUint32(reader);
            var destRange = readUint32(reader);
            ranges.push({ sourceRange: sourceRange, destRange: destRange });
        }
        return { compositeGrayBlendSource: compositeGrayBlendSource, compositeGraphBlendDestinationRange: compositeGraphBlendDestinationRange, ranges: ranges };
    });
}
function readLayerChannelImageData(reader, psd, layer, channels, options) {
    var layerWidth = (layer.right || 0) - (layer.left || 0);
    var layerHeight = (layer.bottom || 0) - (layer.top || 0);
    var canvas;
    var context;
    var data;
    if (layerWidth && layerHeight) {
        canvas = helpers_1.createCanvas(layerWidth, layerHeight);
        context = canvas.getContext('2d');
        data = context.createImageData(layerWidth, layerHeight);
        helpers_1.resetCanvas(data);
    }
    for (var _i = 0, channels_1 = channels; _i < channels_1.length; _i++) {
        var channel = channels_1[_i];
        var compression = readUint16(reader);
        if (channel.id === -2 /* UserMask */) {
            var mask = layer.mask;
            if (!mask) {
                throw new Error("Missing layer mask data");
            }
            var maskWidth = (mask.right || 0) - (mask.left || 0);
            var maskHeight = (mask.bottom || 0) - (mask.top || 0);
            if (maskWidth && maskHeight) {
                mask.canvas = helpers_1.createCanvas(maskWidth, maskHeight);
                var context_1 = mask.canvas.getContext('2d');
                var data_1 = context_1.createImageData(maskWidth, maskHeight);
                helpers_1.resetCanvas(data_1);
                readData(reader, data_1, compression, maskWidth, maskHeight, 0);
                setupGrayscale(data_1);
                context_1.putImageData(data_1, 0, 0);
            }
        }
        else {
            var offset = helpers_1.offsetForChannel(channel.id);
            var targetData = data;
            /* istanbul ignore if */
            if (offset < 0) {
                targetData = undefined;
                if (options.throwForMissingFeatures) {
                    throw new Error("Channel not supported: " + channel.id);
                }
            }
            readData(reader, targetData, compression, layerWidth, layerHeight, offset);
            if (targetData && psd.colorMode === 1 /* Grayscale */) {
                setupGrayscale(targetData);
            }
        }
    }
    if (context && data) {
        context.putImageData(data, 0, 0);
        layer.canvas = canvas;
    }
}
function readData(reader, data, compression, width, height, offset) {
    if (compression === 0 /* RawData */) {
        helpers_1.readDataRaw(reader, data, offset, width, height);
    }
    else if (compression === 1 /* RleCompressed */) {
        helpers_1.readDataRLE(reader, data, width, height, 4, [offset]);
    }
    else {
        throw new Error("Compression type not supported: " + compression);
    }
}
function readGlobalLayerMaskInfo(reader) {
    return readSection(reader, 1, function (left) {
        if (left()) {
            var overlayColorSpace = readUint16(reader);
            var colorSpace1 = readUint16(reader);
            var colorSpace2 = readUint16(reader);
            var colorSpace3 = readUint16(reader);
            var colorSpace4 = readUint16(reader);
            var opacity = readUint16(reader);
            var kind = readUint8(reader);
            skipBytes(reader, left());
            return { overlayColorSpace: overlayColorSpace, colorSpace1: colorSpace1, colorSpace2: colorSpace2, colorSpace3: colorSpace3, colorSpace4: colorSpace4, opacity: opacity, kind: kind };
        }
    });
}
function readAdditionalLayerInfo(reader, target, logMissing) {
    checkSignature(reader, '8BIM', '8B64');
    var key = readSignature(reader);
    readSection(reader, 2, function (left) {
        var handler = additionalInfo_1.getHandler(key);
        if (handler) {
            handler.read(reader, target, left);
        }
        else {
            logMissing && console.log("Unhandled additional info: " + key);
            skipBytes(reader, left());
        }
        if (left()) {
            logMissing && console.log("Unread " + left() + " bytes left for tag: " + key);
            skipBytes(reader, left());
        }
    });
}
function readImageData(reader, psd, globalAlpha) {
    var compression = readUint16(reader);
    if (supportedColorModes.indexOf(psd.colorMode) === -1)
        throw new Error("Color mode not supported: " + psd.colorMode);
    if (compression !== 0 /* RawData */ && compression !== 1 /* RleCompressed */)
        throw new Error("Compression type not supported: " + compression);
    var canvas = helpers_1.createCanvas(psd.width, psd.height);
    var context = canvas.getContext('2d');
    var data = context.createImageData(psd.width, psd.height);
    helpers_1.resetCanvas(data);
    if (psd.colorMode === 0 /* Bitmap */) {
        var bytes = void 0;
        if (compression === 0 /* RawData */) {
            bytes = readBytes(reader, Math.ceil(psd.width / 8) * psd.height);
        }
        else if (compression === 1 /* RleCompressed */) {
            bytes = new Uint8Array(psd.width * psd.height);
            helpers_1.readDataRLE(reader, { data: bytes, width: psd.width, height: psd.height }, psd.width, psd.height, 1, [0]);
        }
        else {
            throw new Error("Unsupported compression: " + compression);
        }
        helpers_1.decodeBitmap(bytes, data.data, psd.width, psd.height);
    }
    else { // Grayscale | RGB
        var channels = psd.colorMode === 3 /* RGB */ ? [0, 1, 2] : [0];
        if (psd.channels && psd.channels > 3) {
            for (var i = 3; i < psd.channels; i++) {
                channels.push(i);
            }
        }
        else if (globalAlpha) {
            channels.push(3);
        }
        if (compression === 0 /* RawData */) {
            for (var i = 0; i < channels.length; i++) {
                helpers_1.readDataRaw(reader, data, channels[i], psd.width, psd.height);
            }
        }
        else if (compression === 1 /* RleCompressed */) {
            helpers_1.readDataRLE(reader, data, psd.width, psd.height, 4, channels);
        }
        if (psd.colorMode === 1 /* Grayscale */) {
            setupGrayscale(data);
        }
    }
    context.putImageData(data, 0, 0);
    psd.canvas = canvas;
}
function readSection(reader, round, func) {
    var length = readInt32(reader);
    if (length <= 0) {
        return undefined;
    }
    var end = reader.offset + length;
    var result = func(function () { return end - reader.offset; });
    /* istanbul ignore if */
    if (reader.offset > end) {
        throw new Error('Exceeded section limits');
    }
    /* istanbul ignore if */
    if (reader.offset !== end) {
        throw new Error("Unread section data: " + (end - reader.offset) + " bytes at 0x" + reader.offset.toString(16));
    }
    while (end % round) {
        end++;
    }
    reader.offset = end;
    return result;
}


},{"./additionalInfo":1,"./helpers":4,"./imageResources":5,"./psd":7}],9:[function(require,module,exports){
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
var psd_1 = require("./psd");
var helpers_1 = require("./helpers");
var additionalInfo_1 = require("./additionalInfo");
var imageResources_1 = require("./imageResources");
function createWriter(size) {
    if (size === void 0) { size = 1024; }
    var buffer = new ArrayBuffer(size);
    var view = new DataView(buffer);
    var offset = 0;
    return { buffer: buffer, view: view, offset: offset };
}
exports.createWriter = createWriter;
function getWriterBuffer(writer) {
    return writer.buffer.slice(0, writer.offset);
}
exports.getWriterBuffer = getWriterBuffer;
function writeUint8(writer, value) {
    var offset = addSize(writer, 1);
    writer.view.setUint8(offset, value);
}
exports.writeUint8 = writeUint8;
function writeInt16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setInt16(offset, value, false);
}
exports.writeInt16 = writeInt16;
function writeUint16(writer, value) {
    var offset = addSize(writer, 2);
    writer.view.setUint16(offset, value, false);
}
exports.writeUint16 = writeUint16;
function writeInt32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setInt32(offset, value, false);
}
exports.writeInt32 = writeInt32;
function writeUint32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setUint32(offset, value, false);
}
exports.writeUint32 = writeUint32;
function writeInt32At(writer, value, offset) {
    writer.view.setInt32(offset, value, false);
}
exports.writeInt32At = writeInt32At;
function writeFloat32(writer, value) {
    var offset = addSize(writer, 4);
    writer.view.setFloat32(offset, value, false);
}
exports.writeFloat32 = writeFloat32;
function writeFloat64(writer, value) {
    var offset = addSize(writer, 8);
    writer.view.setFloat64(offset, value, false);
}
exports.writeFloat64 = writeFloat64;
function writeBytes(writer, buffer) {
    if (buffer) {
        ensureSize(writer, writer.offset + buffer.length);
        var bytes = new Uint8Array(writer.buffer);
        bytes.set(buffer, writer.offset);
        writer.offset += buffer.length;
    }
}
exports.writeBytes = writeBytes;
function writeZeros(writer, count) {
    for (var i = 0; i < count; i++) {
        writeUint8(writer, 0);
    }
}
exports.writeZeros = writeZeros;
function writeSignature(writer, signature) {
    if (signature.length !== 4) {
        throw new Error("Invalid signature: '" + signature + "'");
    }
    for (var i = 0; i < 4; i++) {
        writeUint8(writer, signature.charCodeAt(i));
    }
}
exports.writeSignature = writeSignature;
// export function writeUtf8String(writer: PsdWriter, value: string) {
// 	const buffer = encodeString(value);
// 	writeBytes(writer, buffer);
// }
function writePascalString(writer, text, padTo) {
    if (padTo === void 0) { padTo = 2; }
    var length = text.length;
    writeUint8(writer, length);
    for (var i = 0; i < length; i++) {
        var code = text.charCodeAt(i);
        writeUint8(writer, code < 128 ? code : '?'.charCodeAt(0));
    }
    while (++length % padTo) {
        writeUint8(writer, 0);
    }
}
exports.writePascalString = writePascalString;
function writeUnicodeString(writer, text) {
    writeUint32(writer, text.length);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
}
exports.writeUnicodeString = writeUnicodeString;
function writeUnicodeStringWithPadding(writer, text) {
    writeUint32(writer, text.length + 1);
    for (var i = 0; i < text.length; i++) {
        writeUint16(writer, text.charCodeAt(i));
    }
    writeUint16(writer, 0);
}
exports.writeUnicodeStringWithPadding = writeUnicodeStringWithPadding;
function writeBuffer(writer, buffer) {
    if (buffer) {
        writeBytes(writer, buffer);
    }
}
exports.writeBuffer = writeBuffer;
function getLayerSize(layer) {
    if (layer.canvas) {
        var _a = helpers_1.getLayerDimentions(layer), width = _a.width, height = _a.height;
        return 2 * height + 2 * width * height;
    }
    else {
        return 0;
    }
}
function getLargestLayerSize(layers) {
    if (layers === void 0) { layers = []; }
    return layers.reduce(function (max, layer) { return Math.max(max, getLayerSize(layer), getLargestLayerSize(layer.children)); }, 0);
}
function writeSection(writer, round, func) {
    var offset = writer.offset;
    writeInt32(writer, 0);
    func();
    var length = writer.offset - offset - 4;
    while ((length % round) !== 0) {
        writeUint8(writer, 0);
        length++;
    }
    writeInt32At(writer, length, offset);
}
function writePsd(writer, psd, options) {
    if (options === void 0) { options = {}; }
    if (!(+psd.width > 0 && +psd.height > 0))
        throw new Error('Invalid document size');
    var imageResources = psd.imageResources || {};
    if (options.generateThumbnail) {
        imageResources = __assign({}, imageResources, { thumbnail: createThumbnail(psd) });
    }
    var canvas = psd.canvas;
    if (canvas && (psd.width !== canvas.width || psd.height !== canvas.height)) {
        throw new Error('Document canvas must have the same size as document');
    }
    var imageData = canvas && canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    var globalAlpha = !!imageData && helpers_1.hasAlpha(imageData);
    var maxBufferSize = Math.max(getLargestLayerSize(psd.children), 4 * 2 * psd.width * psd.height + 2 * psd.height);
    var tempBuffer = new Uint8Array(maxBufferSize);
    writeHeader(writer, psd, globalAlpha);
    writeColorModeData(writer, psd);
    writeImageResources(writer, imageResources);
    writeLayerAndMaskInfo(tempBuffer, writer, psd, globalAlpha, options);
    writeImageData(tempBuffer, writer, globalAlpha, psd.width, psd.height, imageData);
}
exports.writePsd = writePsd;
function writeHeader(writer, psd, globalAlpha) {
    writeSignature(writer, '8BPS');
    writeUint16(writer, 1); // version
    writeZeros(writer, 6);
    writeUint16(writer, globalAlpha ? 4 : 3); // channels
    writeUint32(writer, psd.height);
    writeUint32(writer, psd.width);
    writeUint16(writer, 8); // bits per channel
    writeUint16(writer, 3 /* RGB */);
}
function writeColorModeData(writer, _psd) {
    writeSection(writer, 1, function () {
        // TODO: implement
    });
}
function writeImageResources(writer, imageResources) {
    writeSection(writer, 1, function () {
        var _loop_1 = function (handler) {
            if (handler.has(imageResources)) {
                writeSignature(writer, '8BIM');
                writeUint16(writer, handler.key);
                writePascalString(writer, '');
                writeSection(writer, 2, function () { return handler.write(writer, imageResources); });
            }
        };
        for (var _i = 0, _a = imageResources_1.getHandlers(); _i < _a.length; _i++) {
            var handler = _a[_i];
            _loop_1(handler);
        }
    });
}
function writeLayerAndMaskInfo(tempBuffer, writer, psd, globalAlpha, options) {
    writeSection(writer, 2, function () {
        writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options);
        writeGlobalLayerMaskInfo(writer);
        writeAdditionalLayerInfo(writer, psd);
    });
}
function writeLayerInfo(tempBuffer, writer, psd, globalAlpha, options) {
    writeSection(writer, 2, function () {
        var layers = [];
        addChildren(layers, psd.children);
        if (!layers.length) {
            layers.push({});
        }
        writeInt16(writer, globalAlpha ? -layers.length : layers.length);
        var layerData = layers.map(function (l, i) { return helpers_1.getChannels(tempBuffer, l, i === 0, options); });
        layerData.forEach(function (l) { return writeLayerRecord(writer, psd, l); });
        layerData.forEach(function (l) { return writeLayerChannelImageData(writer, l); });
    });
}
var LayerFlags;
(function (LayerFlags) {
    LayerFlags[LayerFlags["TransparencyProtected"] = 1] = "TransparencyProtected";
    LayerFlags[LayerFlags["Hidden"] = 2] = "Hidden";
    LayerFlags[LayerFlags["Obsolete"] = 4] = "Obsolete";
    LayerFlags[LayerFlags["HasRelevantBit4"] = 8] = "HasRelevantBit4";
    LayerFlags[LayerFlags["PixelDataIrrelevantToAppearanceOfDocument"] = 16] = "PixelDataIrrelevantToAppearanceOfDocument";
})(LayerFlags || (LayerFlags = {}));
function writeLayerRecord(writer, psd, layerData) {
    var layer = layerData.layer, top = layerData.top, left = layerData.left, bottom = layerData.bottom, right = layerData.right, channels = layerData.channels;
    writeInt32(writer, top);
    writeInt32(writer, left);
    writeInt32(writer, bottom);
    writeInt32(writer, right);
    writeUint16(writer, channels.length);
    for (var _i = 0, channels_1 = channels; _i < channels_1.length; _i++) {
        var c = channels_1[_i];
        writeInt16(writer, c.channelId);
        writeInt32(writer, c.length);
    }
    writeSignature(writer, '8BIM');
    writeSignature(writer, psd_1.fromBlendMode[layer.blendMode || 'normal']);
    writeUint8(writer, typeof layer.opacity !== 'undefined' ? layer.opacity : 255);
    writeUint8(writer, layer.clipping ? 1 : 0);
    var flags = 0 |
        (layer.transparencyProtected ? 1 /* TransparencyProtected */ : 0) |
        (layer.hidden ? 2 /* Hidden */ : 0) |
        8 /* HasRelevantBit4 */;
    writeUint8(writer, flags);
    writeUint8(writer, 0); // filler
    writeSection(writer, 1, function () {
        writeLayerMaskData(writer, layer, layerData);
        writeLayerBlendingRanges(writer, psd);
        writePascalString(writer, layer.name || '', 4);
        writeAdditionalLayerInfo(writer, layer);
    });
}
function writeLayerMaskData(writer, _a, layerData) {
    var mask = _a.mask;
    writeSection(writer, 4, function () {
        if (mask && layerData.mask) {
            writeInt32(writer, layerData.mask.top);
            writeInt32(writer, layerData.mask.left);
            writeInt32(writer, layerData.mask.bottom);
            writeInt32(writer, layerData.mask.right);
            writeUint8(writer, mask.defaultColor || 0);
            var flags = 0 |
                (mask.disabled ? 2 /* LayerMaskDisabled */ : 0) |
                (mask.positionRelativeToLayer ? 1 /* PositionRelativeToLayer */ : 0);
            writeUint8(writer, flags);
            var parameters = 0 |
                (mask.userMaskDensity !== undefined ? 1 /* UserMaskDensity */ : 0) |
                (mask.userMaskFeather !== undefined ? 2 /* UserMaskFeather */ : 0) |
                (mask.vectorMaskDensity !== undefined ? 1 /* UserMaskDensity */ : 0) |
                (mask.vectorMaskFeather !== undefined ? 2 /* UserMaskFeather */ : 0);
            if (parameters) {
                writeUint8(writer, parameters);
                if (mask.userMaskDensity !== undefined)
                    writeUint8(writer, mask.userMaskDensity);
                if (mask.userMaskFeather !== undefined)
                    writeFloat64(writer, mask.userMaskFeather);
                if (mask.vectorMaskDensity !== undefined)
                    writeUint8(writer, mask.vectorMaskDensity);
                if (mask.vectorMaskFeather !== undefined)
                    writeFloat64(writer, mask.vectorMaskFeather);
            }
            // TODO: handler rest of the fields
            // writeZeros(writer, 2);
        }
    });
}
function writeLayerBlendingRanges(writer, psd) {
    writeSection(writer, 1, function () {
        writeUint32(writer, 65535);
        writeUint32(writer, 65535);
        // TODO: use always 4 instead ?
        var channels = psd.channels || 0;
        for (var i = 0; i < channels; i++) {
            writeUint32(writer, 65535);
            writeUint32(writer, 65535);
        }
    });
}
function writeLayerChannelImageData(writer, _a) {
    var channels = _a.channels;
    for (var _i = 0, channels_2 = channels; _i < channels_2.length; _i++) {
        var channel = channels_2[_i];
        writeUint16(writer, channel.compression);
        if (channel.buffer) {
            writeBuffer(writer, channel.buffer);
        }
    }
}
function writeGlobalLayerMaskInfo(writer) {
    writeSection(writer, 1, function () {
        // TODO: implement
    });
}
function writeAdditionalLayerInfo(writer, target) {
    var _loop_2 = function (handler) {
        if (handler.has(target)) {
            writeSignature(writer, '8BIM');
            writeSignature(writer, handler.key);
            writeSection(writer, 4, function () { return handler.write(writer, target); });
        }
    };
    for (var _i = 0, _a = additionalInfo_1.getHandlers(); _i < _a.length; _i++) {
        var handler = _a[_i];
        _loop_2(handler);
    }
}
function writeImageData(tempBuffer, writer, globalAlpha, width, height, imageData) {
    var channels = globalAlpha ? [0, 1, 2, 3] : [0, 1, 2];
    var data = imageData || {
        data: new Uint8Array(4 * width * height),
        width: width,
        height: height,
    };
    writeUint16(writer, 1 /* RleCompressed */);
    writeBytes(writer, helpers_1.writeDataRLE(tempBuffer, data, width, height, channels));
}
function addChildren(layers, children) {
    if (!children)
        return;
    for (var _i = 0, children_1 = children; _i < children_1.length; _i++) {
        var c = children_1[_i];
        if (c.children && c.canvas) {
            throw new Error("Invalid layer: cannot have both 'canvas' and 'children' properties set");
        }
        if (c.children) { // @Iraka-C: a group here
			function groupBlendModeKey(mode){ // blend mode to key
				return {"normal":"norm","multiply":"mul ","screen":"scrn","overlay":"over","darken":"dark","color burn":"idiv","linear burn":"lbrn","darker color":"dkCl","lighten":"lite","color dodge":"div ","linear dodge":"lddg","lighter color":"lgCl","soft light":"sLit","hard light":"hLit","vivid light":"vLit","linear light":"lLit","pin light":"pLit","hard mix":"hMix","difference":"diff","exclusion":"smud","subtract":"fsub","divide":"fdiv","hue":"hue ","saturation":"sat ","color":"colr","luminosity":"lum "
				}[mode]||"norm"; // regardless of "pass", which is not supported in Skeeetch (yet)
			}
            var sectionDivider = {
                type: c.opened === false ? 2 /* ClosedFolder */ : 1 /* OpenFolder */,
                key: groupBlendModeKey(c.blendMode), // @Iraka-C: modified here for group compability
                subtype: 0,
            };
            layers.push({
                name: '</Layer group>',
                sectionDivider: {
                    type: 3 /* BoundingSectionDivider */,
                },
            });
            addChildren(layers, c.children);
            layers.push(__assign({}, c, { sectionDivider: sectionDivider }));
        }
        else {
            layers.push(__assign({}, c));
        }
    }
}
function resizeBuffer(writer, size) {
    var newLength = writer.buffer.byteLength;
    do {
        newLength *= 2;
    } while (size > newLength);
    var newBuffer = new ArrayBuffer(newLength);
    var newBytes = new Uint8Array(newBuffer);
    var oldBytes = new Uint8Array(writer.buffer);
    newBytes.set(oldBytes);
    writer.buffer = newBuffer;
    writer.view = new DataView(writer.buffer);
}
function ensureSize(writer, size) {
    if (size > writer.buffer.byteLength) {
        resizeBuffer(writer, size);
    }
}
function addSize(writer, size) {
    var offset = writer.offset;
    ensureSize(writer, writer.offset += size);
    return offset;
}
function createThumbnail(psd) {
    var canvas = helpers_1.createCanvas(10, 10);
    var scale = 1;
    if (psd.width > psd.height) {
        canvas.width = 160;
        canvas.height = Math.floor(psd.height * (canvas.width / psd.width));
        scale = canvas.width / psd.width;
    }
    else {
        canvas.height = 160;
        canvas.width = Math.floor(psd.width * (canvas.height / psd.height));
        scale = canvas.height / psd.height;
    }
    var context = canvas.getContext('2d');
    context.scale(scale, scale);
    if (psd.canvas) {
        context.drawImage(psd.canvas, 0, 0);
    }
    return canvas;
}


},{"./additionalInfo":1,"./helpers":4,"./imageResources":5,"./psd":7}],10:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  for (var i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(
      uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)
    ))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],11:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

},{"base64-js":10,"ieee754":12}],12:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}]},{},[6])(6)
});
