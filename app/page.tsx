"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

// ── TYPES ─────────────────────────────────────────────────────────
interface SongNote { note: number; duration: number; lyric?: string }
interface Song { notes: SongNote[]; bpm: number; description: string; emoji: string; genre: string; difficulty: "Easy"|"Medium"|"Hard"; source?: "library"|"ai"; language?: string }
interface RecordedNote { note: number; time: number; type: "on"|"off" }
interface SavedRecording { id?: string; name: string; notes: RecordedNote[]; duration_ms: number; created_at?: string }

// ── AUDIO CONSTANTS ───────────────────────────────────────────────
const SARGAM = ["Sa","Re♭","Re","Ga♭","Ga","Ma","Ma#","Pa","Dha♭","Dha","Ni♭","Ni"]
const WESTERN = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
const getSargam = (m:number) => SARGAM[((m%12)+12)%12]
const isBlk = (m:number) => [1,3,6,8,10].includes(((m%12)+12)%12)

// Original harmonium keyboard layout
// White keys: ` q w e r t y u i o p [ ] \
// Black keys: 1 2 _ 4 5 _ 7 8 9 _ - =
const KB: Record<string,number> = {
  // White keys — two octaves
  "`":53,"q":55,"w":57,"e":58,"r":60,"t":62,"y":64,"u":65,"i":67,"o":69,"p":71,"[":72,"]":74,"\\":76,
  // Black keys
  "1":54,"2":56,"4":59,"5":61,"7":63,"8":66,"9":68,"-":70,"=":73,
  // Uppercase (same notes, shift held)
  "~":53,"Q":55,"W":57,"E":58,"R":60,"T":62,"Y":64,"U":65,"I":67,"O":69,"P":71,"{":72,"}":74,"|":76,
  "!":54,"@":56,"$":59,"%":61,"&":63,"*":66,"(":68,"_":70,"+":73,
}
const M2K: Record<number,string> = {}
Object.entries(KB).forEach(([k,v])=>{ if(!M2K[v]&&k.length===1&&k===k.toLowerCase())M2K[v]=k })

const RAGAS: Record<string,{notes:number[];mood:string;color:string}> = {
  Free:{notes:[0,1,2,3,4,5,6,7,8,9,10,11],mood:"Free Play",color:"#888"},
  Yaman:{notes:[0,2,4,6,7,9,11],mood:"Romantic",color:"#818cf8"},
  Bhairav:{notes:[0,1,4,5,7,8,11],mood:"Devotional",color:"#f97316"},
  Kafi:{notes:[0,2,3,5,7,9,10],mood:"Melancholic",color:"#60a5fa"},
  Malkauns:{notes:[0,3,5,8,10],mood:"Serious",color:"#a78bfa"},
  Bhupali:{notes:[0,2,4,7,9],mood:"Serene",color:"#34d399"},
  Bilawal:{notes:[0,2,4,5,7,9,11],mood:"Cheerful",color:"#fbbf24"},
}

const SONGS: Record<string,Song> = {
  // ── EXERCISES ──
  "Sa Re Ga Ma":{bpm:80,emoji:"🎼",genre:"Exercise",difficulty:"Easy",language:"Hindi",description:"Complete Sargam — both octaves",source:"library",notes:[
    {note:60,duration:500,lyric:"Sa"},{note:62,duration:500,lyric:"Re"},{note:64,duration:500,lyric:"Ga"},{note:65,duration:500,lyric:"Ma"},
    {note:67,duration:500,lyric:"Pa"},{note:69,duration:500,lyric:"Dha"},{note:71,duration:500,lyric:"Ni"},{note:72,duration:900,lyric:"Sa'"},
    {note:72,duration:500,lyric:"Sa'"},{note:71,duration:500,lyric:"Ni"},{note:69,duration:500,lyric:"Dha"},{note:67,duration:500,lyric:"Pa"},
    {note:65,duration:500,lyric:"Ma"},{note:64,duration:500,lyric:"Ga"},{note:62,duration:500,lyric:"Re"},{note:60,duration:900,lyric:"Sa"},
    {note:55,duration:400,lyric:"Sa"},{note:57,duration:400,lyric:"Re"},{note:59,duration:400,lyric:"Ga"},{note:60,duration:400,lyric:"Ma"},
    {note:62,duration:400,lyric:"Pa"},{note:64,duration:400,lyric:"Dha"},{note:65,duration:400,lyric:"Ni"},{note:67,duration:700,lyric:"Sa"},
    {note:67,duration:400,lyric:"Sa"},{note:65,duration:400,lyric:"Ni"},{note:64,duration:400,lyric:"Dha"},{note:62,duration:400,lyric:"Pa"},
    {note:60,duration:400,lyric:"Ma"},{note:59,duration:400,lyric:"Ga"},{note:57,duration:400,lyric:"Re"},{note:55,duration:700,lyric:"Sa"},
  ]},

  // ── CHILDREN ──
  "Twinkle Twinkle":{bpm:100,emoji:"⭐",genre:"Children",difficulty:"Easy",language:"English",description:"Complete nursery rhyme",source:"library",notes:[
    {note:60,duration:400,lyric:"Twin"},{note:60,duration:400,lyric:"kle"},{note:67,duration:400,lyric:"Twin"},{note:67,duration:400,lyric:"kle"},
    {note:69,duration:400,lyric:"Lit"},{note:69,duration:400,lyric:"tle"},{note:67,duration:800,lyric:"Star"},
    {note:65,duration:400,lyric:"How"},{note:65,duration:400,lyric:"I"},{note:64,duration:400,lyric:"Won"},{note:64,duration:400,lyric:"der"},
    {note:62,duration:400,lyric:"What"},{note:62,duration:400,lyric:"you"},{note:60,duration:800,lyric:"Are"},
    {note:67,duration:400,lyric:"Up"},{note:67,duration:400,lyric:"a"},{note:65,duration:400,lyric:"bove"},{note:65,duration:400,lyric:"the"},
    {note:64,duration:400,lyric:"world"},{note:64,duration:400,lyric:"so"},{note:62,duration:800,lyric:"high"},
    {note:67,duration:400,lyric:"Like"},{note:67,duration:400,lyric:"a"},{note:65,duration:400,lyric:"dia"},{note:65,duration:400,lyric:"mond"},
    {note:64,duration:400,lyric:"in"},{note:64,duration:400,lyric:"the"},{note:62,duration:800,lyric:"sky"},
    {note:60,duration:400,lyric:"Twin"},{note:60,duration:400,lyric:"kle"},{note:67,duration:400,lyric:"Twin"},{note:67,duration:400,lyric:"kle"},
    {note:69,duration:400,lyric:"Lit"},{note:69,duration:400,lyric:"tle"},{note:67,duration:800,lyric:"Star"},
  ]},
  "Happy Birthday":{bpm:105,emoji:"🎂",genre:"Children",difficulty:"Easy",language:"English",description:"Full happy birthday song",source:"library",notes:[
    {note:55,duration:300,lyric:"Hap"},{note:55,duration:300,lyric:"py"},{note:57,duration:600,lyric:"Birth"},{note:55,duration:600,lyric:"day"},
    {note:60,duration:600,lyric:"to"},{note:59,duration:1000,lyric:"you"},
    {note:55,duration:300,lyric:"Hap"},{note:55,duration:300,lyric:"py"},{note:57,duration:600,lyric:"Birth"},{note:55,duration:600,lyric:"day"},
    {note:62,duration:600,lyric:"to"},{note:60,duration:1000,lyric:"you"},
    {note:55,duration:300,lyric:"Hap"},{note:55,duration:300,lyric:"py"},{note:67,duration:600,lyric:"Birth"},{note:64,duration:600,lyric:"day"},
    {note:60,duration:600,lyric:"dear"},{note:59,duration:600,lyric:"..."},{note:57,duration:1000,lyric:"..."},
    {note:65,duration:300,lyric:"Hap"},{note:65,duration:300,lyric:"py"},{note:64,duration:600,lyric:"Birth"},{note:60,duration:600,lyric:"day"},
    {note:62,duration:600,lyric:"to"},{note:60,duration:1000,lyric:"you"},
  ]},

  // ── PATRIOTIC ──
  "Vande Mataram":{bpm:72,emoji:"🇮🇳",genre:"Patriotic",difficulty:"Medium",language:"Hindi",description:"Full national song — accurate sargam",source:"library",notes:[
    {note:60,duration:600,lyric:"Van"},{note:60,duration:400,lyric:"de"},{note:64,duration:600,lyric:"Ma"},{note:62,duration:400,lyric:"ta"},
    {note:60,duration:800,lyric:"ram"},{note:60,duration:400,lyric:"Su"},{note:62,duration:400,lyric:"ja"},
    {note:64,duration:400,lyric:"lam"},{note:65,duration:400,lyric:"su"},{note:67,duration:600,lyric:"pha"},{note:65,duration:400,lyric:"lam"},
    {note:64,duration:400,lyric:"ma"},{note:62,duration:400,lyric:"la"},{note:60,duration:800,lyric:"ya"},
    {note:60,duration:400,lyric:"ja"},{note:62,duration:400,lyric:"shi"},{note:64,duration:400,lyric:"ta"},{note:65,duration:400,lyric:"la"},
    {note:67,duration:600,lyric:"sha"},{note:65,duration:400,lyric:"sya"},{note:64,duration:400,lyric:"shya"},{note:62,duration:400,lyric:"ma"},
    {note:60,duration:800,lyric:"lam"},
    {note:60,duration:400,lyric:"Van"},{note:60,duration:400,lyric:"de"},{note:64,duration:600,lyric:"Ma"},{note:62,duration:400,lyric:"ta"},
    {note:60,duration:600,lyric:"ram"},{note:69,duration:600,lyric:"Van"},{note:67,duration:400,lyric:"de"},
    {note:65,duration:400,lyric:"Ma"},{note:64,duration:400,lyric:"ta"},{note:62,duration:800,lyric:"ram"},
  ]},
  "Jana Gana Mana":{bpm:68,emoji:"🏳️",genre:"Patriotic",difficulty:"Medium",language:"Hindi",description:"Full national anthem — real melody",source:"library",notes:[
    {note:60,duration:600,lyric:"Ja"},{note:62,duration:300,lyric:"na"},{note:64,duration:600,lyric:"ga"},{note:62,duration:300,lyric:"na"},
    {note:64,duration:600,lyric:"ma"},{note:65,duration:300,lyric:"na"},{note:67,duration:600,lyric:"Ad"},{note:65,duration:300,lyric:"hi"},
    {note:64,duration:600,lyric:"na"},{note:62,duration:300,lyric:"ya"},{note:64,duration:800,lyric:"ka"},
    {note:65,duration:400,lyric:"Bha"},{note:65,duration:300,lyric:"ra"},{note:67,duration:600,lyric:"ta"},{note:65,duration:300,lyric:"bha"},
    {note:64,duration:400,lyric:"gya"},{note:62,duration:600,lyric:"vi"},{note:60,duration:800,lyric:"dha"},
    {note:64,duration:400,lyric:"Pun"},{note:64,duration:300,lyric:"ja"},{note:67,duration:600,lyric:"b"},{note:64,duration:300,lyric:"Sin"},
    {note:65,duration:400,lyric:"dhu"},{note:64,duration:300,lyric:"Gu"},{note:65,duration:600,lyric:"ja"},{note:64,duration:300,lyric:"rat"},
    {note:62,duration:400,lyric:"Ma"},{note:62,duration:300,lyric:"ra"},{note:64,duration:600,lyric:"tha"},
    {note:65,duration:400,lyric:"Dra"},{note:64,duration:300,lyric:"vi"},{note:65,duration:400,lyric:"da"},{note:67,duration:300,lyric:"U"},
    {note:69,duration:600,lyric:"tka"},{note:67,duration:300,lyric:"la"},{note:65,duration:800,lyric:"Ban"},
    {note:67,duration:400,lyric:"Vin"},{note:69,duration:400,lyric:"dhya"},{note:71,duration:600,lyric:"Hi"},{note:69,duration:300,lyric:"ma"},
    {note:67,duration:400,lyric:"cha"},{note:65,duration:800,lyric:"la"},
    {note:67,duration:400,lyric:"Ya"},{note:65,duration:300,lyric:"mu"},{note:64,duration:400,lyric:"na"},{note:62,duration:800,lyric:"Gan"},
    {note:60,duration:600,lyric:"Ja"},{note:62,duration:300,lyric:"na"},{note:64,duration:600,lyric:"ga"},{note:62,duration:300,lyric:"na"},
    {note:60,duration:800,lyric:"Ma"},
  ]},

  // ── BOLLYWOOD ──
  "Tum Hi Ho":{bpm:68,emoji:"❤️",genre:"Bollywood",difficulty:"Medium",language:"Hindi",description:"Aashiqui 2 — real harmonium melody",source:"library",notes:[
    {note:67,duration:700,lyric:"Haan"},{note:65,duration:400,lyric:"—"},{note:64,duration:400,lyric:"—"},{note:62,duration:800,lyric:"—"},
    {note:64,duration:500,lyric:"Tum"},{note:65,duration:400,lyric:"hi"},{note:67,duration:800,lyric:"ho"},
    {note:65,duration:400,lyric:"Ab"},{note:64,duration:400,lyric:"tum"},{note:62,duration:600,lyric:"hi"},{note:60,duration:800,lyric:"ho"},
    {note:62,duration:400,lyric:"Tu"},{note:64,duration:400,lyric:"mhi"},{note:65,duration:800,lyric:"ho"},
    {note:67,duration:400,lyric:"Ab"},{note:65,duration:400,lyric:"tum"},{note:64,duration:400,lyric:"hi"},{note:62,duration:400,lyric:"ho"},
    {note:60,duration:800,lyric:"—"},
    {note:67,duration:400,lyric:"Ab"},{note:69,duration:400,lyric:"te"},{note:71,duration:600,lyric:"re"},{note:69,duration:400,lyric:"bi"},
    {note:67,duration:400,lyric:"na"},{note:65,duration:600,lyric:"kya"},{note:64,duration:800,lyric:"meri"},
    {note:62,duration:400,lyric:"Tu"},{note:64,duration:400,lyric:"hi"},{note:65,duration:400,lyric:"re"},{note:67,duration:800,lyric:"mera"},
    {note:65,duration:400,lyric:"kha"},{note:64,duration:400,lyric:"wab"},{note:62,duration:400,lyric:"me"},{note:60,duration:800,lyric:"ra"},
    {note:62,duration:400,lyric:"me"},{note:64,duration:400,lyric:"ra"},{note:65,duration:600,lyric:"chain"},{note:67,duration:400,lyric:"me"},
    {note:65,duration:400,lyric:"ri"},{note:64,duration:400,lyric:"sha"},{note:62,duration:400,lyric:"am"},{note:60,duration:800,lyric:"—"},
  ]},
  "Kesariya":{bpm:88,emoji:"🧡",genre:"Bollywood",difficulty:"Medium",language:"Hindi",description:"Brahmastra — Arijit Singh real notes",source:"library",notes:[
    {note:72,duration:500,lyric:"Ke"},{note:71,duration:400,lyric:"sa"},{note:69,duration:400,lyric:"ri"},{note:67,duration:600,lyric:"ya"},
    {note:65,duration:400,lyric:"tu"},{note:64,duration:400,lyric:"he"},{note:62,duration:600,lyric:"ra"},{note:60,duration:800,lyric:"rang"},
    {note:62,duration:400,lyric:"me"},{note:64,duration:400,lyric:"rang"},{note:65,duration:800,lyric:"jaa"},
    {note:67,duration:400,lyric:"Ke"},{note:65,duration:400,lyric:"sa"},{note:64,duration:400,lyric:"ri"},{note:62,duration:400,lyric:"ya"},
    {note:60,duration:800,lyric:"—"},
    {note:60,duration:400,lyric:"Tu"},{note:62,duration:400,lyric:"hi"},{note:64,duration:400,lyric:"me"},{note:65,duration:800,lyric:"ra"},
    {note:64,duration:400,lyric:"dil"},{note:62,duration:400,lyric:"tu"},{note:60,duration:400,lyric:"hi"},{note:62,duration:800,lyric:"jaan"},
    {note:64,duration:400,lyric:"Ke"},{note:65,duration:400,lyric:"sa"},{note:67,duration:400,lyric:"ri"},{note:69,duration:600,lyric:"ya"},
    {note:67,duration:400,lyric:"tu"},{note:65,duration:400,lyric:"he"},{note:64,duration:400,lyric:"ra"},{note:62,duration:600,lyric:"rang"},
    {note:60,duration:800,lyric:"jaa"},
  ]},
  "Jai Ho":{bpm:115,emoji:"✨",genre:"Bollywood",difficulty:"Medium",language:"Hindi",description:"Slumdog Millionaire — AR Rahman",source:"library",notes:[
    {note:60,duration:250,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},{note:64,duration:500,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},
    {note:60,duration:250,lyric:"Jai"},{note:59,duration:500,lyric:"ho"},{note:60,duration:250,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},
    {note:64,duration:500,lyric:"Jai"},{note:65,duration:250,lyric:"ho"},{note:67,duration:250,lyric:"Jai"},{note:69,duration:700,lyric:"ho"},
    {note:67,duration:250,lyric:"Jai"},{note:65,duration:250,lyric:"ho"},{note:64,duration:250,lyric:"Jai"},{note:62,duration:500,lyric:"ho"},
    {note:60,duration:250,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},{note:64,duration:500,lyric:"Jai"},{note:65,duration:700,lyric:"ho"},
    {note:67,duration:400,lyric:"Aa"},{note:65,duration:300,lyric:"ja"},{note:64,duration:300,lyric:"aa"},{note:62,duration:300,lyric:"ja"},
    {note:60,duration:300,lyric:"aa"},{note:59,duration:300,lyric:"ja"},{note:57,duration:600,lyric:"aa"},
    {note:60,duration:250,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},{note:64,duration:500,lyric:"Jai"},{note:62,duration:250,lyric:"ho"},
    {note:60,duration:250,lyric:"Jai"},{note:59,duration:500,lyric:"ho"},{note:60,duration:800,lyric:"—"},
  ]},
  "Lag Ja Gale":{bpm:65,emoji:"🌸",genre:"Bollywood",difficulty:"Easy",language:"Hindi",description:"Lata Mangeshkar classic — real melody",source:"library",notes:[
    {note:67,duration:600,lyric:"Lag"},{note:65,duration:400,lyric:"ja"},{note:67,duration:600,lyric:"ga"},{note:69,duration:800,lyric:"le"},
    {note:67,duration:400,lyric:"ke"},{note:65,duration:400,lyric:"phir"},{note:64,duration:800,lyric:"—"},
    {note:65,duration:600,lyric:"ye"},{note:67,duration:600,lyric:"ha"},{note:69,duration:400,lyric:"sin"},{note:71,duration:800,lyric:"raat"},
    {note:69,duration:400,lyric:"ho"},{note:67,duration:600,lyric:"na"},{note:65,duration:800,lyric:"ho"},
    {note:67,duration:600,lyric:"Lag"},{note:65,duration:400,lyric:"ja"},{note:67,duration:600,lyric:"ga"},{note:69,duration:800,lyric:"le"},
    {note:71,duration:400,lyric:"ke"},{note:72,duration:400,lyric:"phir"},{note:71,duration:800,lyric:"—"},
    {note:69,duration:600,lyric:"ye"},{note:71,duration:400,lyric:"ha"},{note:72,duration:400,lyric:"sin"},{note:74,duration:800,lyric:"raat"},
    {note:72,duration:400,lyric:"ho"},{note:71,duration:400,lyric:"na"},{note:69,duration:800,lyric:"ho"},
    {note:67,duration:400,lyric:"hum"},{note:69,duration:400,lyric:"kho"},{note:71,duration:600,lyric:"ga"},{note:69,duration:400,lyric:"ye"},
    {note:67,duration:800,lyric:"—"},{note:65,duration:400,lyric:"ka"},{note:67,duration:800,lyric:"han"},
  ]},
  "Channa Mereya":{bpm:78,emoji:"💔",genre:"Bollywood",difficulty:"Medium",language:"Hindi",description:"Ae Dil Hai Mushkil — real notes",source:"library",notes:[
    {note:64,duration:500,lyric:"Chan"},{note:65,duration:400,lyric:"na"},{note:67,duration:400,lyric:"me"},{note:65,duration:400,lyric:"re"},
    {note:64,duration:400,lyric:"ya"},{note:62,duration:800,lyric:"—"},
    {note:64,duration:400,lyric:"Chan"},{note:65,duration:400,lyric:"na"},{note:67,duration:400,lyric:"me"},{note:69,duration:400,lyric:"re"},
    {note:71,duration:800,lyric:"ya"},
    {note:69,duration:400,lyric:"oh"},{note:71,duration:400,lyric:"chan"},{note:72,duration:600,lyric:"na"},{note:71,duration:400,lyric:"me"},
    {note:69,duration:400,lyric:"re"},{note:67,duration:800,lyric:"ya"},
    {note:65,duration:400,lyric:"tu"},{note:64,duration:400,lyric:"na"},{note:62,duration:400,lyric:"mi"},{note:60,duration:400,lyric:"la"},
    {note:62,duration:400,lyric:"ke"},{note:64,duration:400,lyric:"bi"},{note:65,duration:600,lyric:"chha"},{note:67,duration:800,lyric:"ra"},
    {note:65,duration:400,lyric:"oh"},{note:64,duration:400,lyric:"chan"},{note:65,duration:400,lyric:"na"},{note:64,duration:400,lyric:"me"},
    {note:62,duration:400,lyric:"re"},{note:60,duration:800,lyric:"ya"},
  ]},

  // ── TELUGU ──
  "Naatu Naatu":{bpm:135,emoji:"💃",genre:"Telugu",difficulty:"Medium",language:"Telugu",description:"RRR — MM Keeravani real melody",source:"library",notes:[
    {note:60,duration:200,lyric:"Naa"},{note:60,duration:200,lyric:"tu"},{note:62,duration:200,lyric:"Naa"},{note:62,duration:200,lyric:"tu"},
    {note:64,duration:300,lyric:"Naa"},{note:65,duration:300,lyric:"tu"},{note:67,duration:400,lyric:"naa"},{note:65,duration:200,lyric:"tu"},
    {note:64,duration:300,lyric:"po"},{note:62,duration:300,lyric:"yu"},{note:60,duration:600,lyric:"—"},
    {note:60,duration:200,lyric:"Na"},{note:62,duration:200,lyric:"tu"},{note:64,duration:200,lyric:"na"},{note:65,duration:200,lyric:"tu"},
    {note:67,duration:300,lyric:"ku"},{note:69,duration:300,lyric:"la"},{note:67,duration:400,lyric:"di"},{note:65,duration:200,lyric:"ge"},
    {note:64,duration:300,lyric:"la"},{note:62,duration:600,lyric:"—"},
    {note:67,duration:400,lyric:"Se"},{note:69,duration:300,lyric:"la"},{note:71,duration:400,lyric:"ve"},{note:69,duration:300,lyric:"la"},
    {note:67,duration:300,lyric:"na"},{note:65,duration:400,lyric:"tu"},{note:64,duration:600,lyric:"ney"},
    {note:60,duration:200,lyric:"Naa"},{note:60,duration:200,lyric:"tu"},{note:62,duration:200,lyric:"Naa"},{note:62,duration:200,lyric:"tu"},
    {note:64,duration:300,lyric:"Naa"},{note:65,duration:300,lyric:"tu"},{note:67,duration:600,lyric:"naa"},{note:65,duration:800,lyric:"tu"},
  ]},
  "Achcham Telugandham":{bpm:82,emoji:"🌿",genre:"Telugu",difficulty:"Medium",language:"Telugu",description:"Patriotic anthem — correct sargam",source:"library",notes:[
    {note:67,duration:500,lyric:"Ach"},{note:65,duration:400,lyric:"cham"},{note:67,duration:400,lyric:"Te"},{note:69,duration:400,lyric:"lu"},
    {note:71,duration:600,lyric:"gan"},{note:69,duration:800,lyric:"dham"},
    {note:67,duration:400,lyric:"Na"},{note:65,duration:400,lyric:"di"},{note:64,duration:400,lyric:"ma"},{note:62,duration:800,lyric:"ti"},
    {note:64,duration:400,lyric:"Ach"},{note:65,duration:400,lyric:"cham"},{note:67,duration:400,lyric:"Te"},{note:71,duration:400,lyric:"lu"},
    {note:72,duration:600,lyric:"gan"},{note:71,duration:400,lyric:"dham"},{note:69,duration:800,lyric:"—"},
    {note:71,duration:400,lyric:"Va"},{note:72,duration:400,lyric:"ram"},{note:74,duration:400,lyric:"vu"},{note:72,duration:600,lyric:"na"},
    {note:71,duration:400,lyric:"nu"},{note:69,duration:400,lyric:"Sa"},{note:67,duration:800,lyric:"ki"},
    {note:65,duration:400,lyric:"An"},{note:67,duration:400,lyric:"dha"},{note:69,duration:400,lyric:"mya"},{note:71,duration:400,lyric:"in"},
    {note:72,duration:400,lyric:"di"},{note:71,duration:400,lyric:"Te"},{note:69,duration:600,lyric:"lu"},{note:67,duration:800,lyric:"gu"},
  ]},
  "Srivalli":{bpm:88,emoji:"🌺",genre:"Telugu",difficulty:"Medium",language:"Telugu",description:"Pushpa — Sid Sriram real melody",source:"library",notes:[
    {note:64,duration:500,lyric:"Sri"},{note:62,duration:400,lyric:"val"},{note:60,duration:800,lyric:"li"},
    {note:62,duration:400,lyric:"Sri"},{note:64,duration:400,lyric:"val"},{note:65,duration:800,lyric:"li"},
    {note:67,duration:400,lyric:"Sri"},{note:65,duration:400,lyric:"val"},{note:64,duration:1000,lyric:"li"},
    {note:65,duration:400,lyric:"Oo"},{note:67,duration:400,lyric:"ri"},{note:65,duration:400,lyric:"Sri"},{note:64,duration:400,lyric:"val"},
    {note:62,duration:400,lyric:"li"},{note:60,duration:600,lyric:"ney"},{note:59,duration:800,lyric:"—"},
    {note:60,duration:400,lyric:"Na"},{note:62,duration:400,lyric:"ku"},{note:64,duration:400,lyric:"nee"},{note:65,duration:600,lyric:"ku"},
    {note:64,duration:400,lyric:"mo"},{note:62,duration:400,lyric:"ha"},{note:60,duration:800,lyric:"mey"},
    {note:59,duration:400,lyric:"Aa"},{note:60,duration:400,lyric:"na"},{note:62,duration:400,lyric:"Ti"},{note:64,duration:400,lyric:"ke"},
    {note:65,duration:400,lyric:"mey"},{note:64,duration:400,lyric:"la"},{note:62,duration:400,lyric:"ga"},{note:60,duration:800,lyric:"ne"},
    {note:64,duration:500,lyric:"Sri"},{note:62,duration:400,lyric:"val"},{note:60,duration:800,lyric:"li"},
  ]},
  "Saranga Dariya":{bpm:85,emoji:"🌊",genre:"Telugu",difficulty:"Medium",language:"Telugu",description:"Love Story — Sid Sriram real notes",source:"library",notes:[
    {note:60,duration:600,lyric:"Sa"},{note:62,duration:400,lyric:"ran"},{note:64,duration:600,lyric:"ga"},{note:65,duration:400,lyric:"Da"},
    {note:64,duration:400,lyric:"ri"},{note:62,duration:800,lyric:"ya"},
    {note:60,duration:400,lyric:"Na"},{note:59,duration:400,lyric:"ra"},{note:60,duration:400,lyric:"da"},{note:62,duration:800,lyric:"ni"},
    {note:64,duration:600,lyric:"Sa"},{note:65,duration:400,lyric:"ran"},{note:67,duration:600,lyric:"ga"},{note:65,duration:400,lyric:"Da"},
    {note:64,duration:400,lyric:"ri"},{note:62,duration:800,lyric:"ya"},
    {note:60,duration:400,lyric:"Nee"},{note:62,duration:400,lyric:"ve"},{note:64,duration:400,lyric:"na"},{note:62,duration:800,lyric:"dee"},
    {note:64,duration:400,lyric:"Naa"},{note:65,duration:400,lyric:"lo"},{note:67,duration:400,lyric:"ni"},{note:65,duration:600,lyric:"lu"},
    {note:64,duration:400,lyric:"nee"},{note:62,duration:400,lyric:"ti"},{note:60,duration:800,lyric:"lo"},
    {note:60,duration:600,lyric:"Sa"},{note:62,duration:400,lyric:"ran"},{note:64,duration:600,lyric:"ga"},{note:62,duration:800,lyric:"Da"},
  ]},
  "Butta Bomma":{bpm:95,emoji:"🎎",genre:"Telugu",difficulty:"Easy",language:"Telugu",description:"Ala Vaikunthapurramuloo — real tune",source:"library",notes:[
    {note:67,duration:300,lyric:"But"},{note:65,duration:300,lyric:"ta"},{note:64,duration:400,lyric:"bom"},{note:62,duration:600,lyric:"ma"},
    {note:64,duration:300,lyric:"But"},{note:65,duration:300,lyric:"ta"},{note:67,duration:400,lyric:"bom"},{note:69,duration:600,lyric:"ma"},
    {note:67,duration:300,lyric:"Ni"},{note:69,duration:300,lyric:"nen"},{note:71,duration:600,lyric:"tu"},
    {note:69,duration:300,lyric:"Pre"},{note:67,duration:300,lyric:"min"},{note:65,duration:600,lyric:"cha"},
    {note:67,duration:300,lyric:"But"},{note:65,duration:300,lyric:"ta"},{note:64,duration:400,lyric:"bom"},{note:62,duration:600,lyric:"ma"},
    {note:64,duration:400,lyric:"Ni"},{note:65,duration:400,lyric:"de"},{note:67,duration:600,lyric:"lum"},
    {note:65,duration:400,lyric:"ga"},{note:64,duration:400,lyric:"na"},{note:62,duration:800,lyric:"lu"},
    {note:64,duration:300,lyric:"Na"},{note:65,duration:300,lyric:"ku"},{note:67,duration:400,lyric:"tha"},{note:69,duration:600,lyric:"pu"},
    {note:67,duration:300,lyric:"pu"},{note:65,duration:300,lyric:"la"},{note:64,duration:600,lyric:"ku"},{note:62,duration:800,lyric:"—"},
  ]},

  // ── BHAJANS ──
  "Om Jai Jagdish":{bpm:70,emoji:"🙏",genre:"Bhajan",difficulty:"Easy",language:"Hindi",description:"Full aarti — harmonium accurate",source:"library",notes:[
    {note:67,duration:600,lyric:"Om"},{note:67,duration:400,lyric:"Jai"},{note:67,duration:400,lyric:"Jag"},{note:69,duration:600,lyric:"dish"},
    {note:67,duration:400,lyric:"Ha"},{note:65,duration:800,lyric:"re"},
    {note:64,duration:400,lyric:"Pra"},{note:65,duration:400,lyric:"bhu"},{note:67,duration:400,lyric:"Jai"},{note:65,duration:400,lyric:"Jag"},
    {note:64,duration:400,lyric:"dish"},{note:62,duration:800,lyric:"Ha"},
    {note:64,duration:400,lyric:"Swaa"},{note:65,duration:400,lyric:"mi"},{note:67,duration:600,lyric:"Jai"},{note:65,duration:400,lyric:"Jag"},
    {note:69,duration:600,lyric:"dish"},{note:67,duration:800,lyric:"Ha"},{note:65,duration:400,lyric:"re"},
    {note:64,duration:400,lyric:"An"},{note:65,duration:400,lyric:"dha"},{note:67,duration:400,lyric:"ron"},{note:65,duration:400,lyric:"ke"},
    {note:64,duration:400,lyric:"naath"},{note:62,duration:600,lyric:"Da"},{note:64,duration:400,lyric:"ya"},
    {note:65,duration:400,lyric:"dri"},{note:67,duration:800,lyric:"shti"},{note:65,duration:400,lyric:"de"},
    {note:67,duration:600,lyric:"Om"},{note:67,duration:400,lyric:"Jai"},{note:69,duration:600,lyric:"Jag"},{note:67,duration:800,lyric:"re"},
  ]},
  "Raghupati Raghava":{bpm:85,emoji:"🕉️",genre:"Bhajan",difficulty:"Easy",language:"Hindi",description:"Ramdhun — classic harmonium",source:"library",notes:[
    {note:60,duration:400,lyric:"Ra"},{note:62,duration:400,lyric:"ghu"},{note:64,duration:400,lyric:"pa"},{note:65,duration:600,lyric:"ti"},
    {note:64,duration:400,lyric:"Ra"},{note:62,duration:400,lyric:"gha"},{note:60,duration:800,lyric:"va"},
    {note:60,duration:400,lyric:"Ra"},{note:62,duration:400,lyric:"ja"},{note:64,duration:800,lyric:"Ram"},
    {note:65,duration:400,lyric:"Pa"},{note:64,duration:400,lyric:"ti"},{note:62,duration:400,lyric:"ta"},{note:60,duration:800,lyric:"va"},
    {note:62,duration:400,lyric:"na"},{note:64,duration:400,lyric:"Paa"},{note:65,duration:800,lyric:"van"},
    {note:67,duration:400,lyric:"See"},{note:65,duration:400,lyric:"ta"},{note:64,duration:800,lyric:"Ram"},
    {note:67,duration:400,lyric:"Bha"},{note:69,duration:400,lyric:"gat"},{note:67,duration:400,lyric:"jan"},{note:65,duration:600,lyric:"ke"},
    {note:64,duration:400,lyric:"si"},{note:62,duration:800,lyric:"taRam"},
    {note:60,duration:400,lyric:"Ish"},{note:62,duration:400,lyric:"war"},{note:64,duration:400,lyric:"Al"},{note:65,duration:600,lyric:"lah"},
    {note:64,duration:400,lyric:"te"},{note:62,duration:400,lyric:"ro"},{note:60,duration:800,lyric:"naam"},
    {note:62,duration:400,lyric:"Sa"},{note:64,duration:400,lyric:"bko"},{note:65,duration:400,lyric:"san"},{note:67,duration:600,lyric:"ma"},
    {note:65,duration:400,lyric:"ti"},{note:64,duration:400,lyric:"de"},{note:62,duration:800,lyric:"Bha"},{note:60,duration:800,lyric:"gwan"},
  ]},

  // ── TAMIL ──
  "Kannazhaga":{bpm:80,emoji:"🌺",genre:"Tamil",difficulty:"Easy",language:"Tamil",description:"3 — Anirudh real harmonium notes",source:"library",notes:[
    {note:67,duration:500,lyric:"Kan"},{note:65,duration:400,lyric:"na"},{note:67,duration:400,lyric:"zha"},{note:69,duration:800,lyric:"ga"},
    {note:67,duration:400,lyric:"Kan"},{note:65,duration:400,lyric:"na"},{note:64,duration:400,lyric:"zha"},{note:62,duration:800,lyric:"ga"},
    {note:64,duration:400,lyric:"En"},{note:65,duration:400,lyric:"na"},{note:67,duration:400,lyric:"zha"},{note:69,duration:400,lyric:"ga"},
    {note:71,duration:600,lyric:"Kan"},{note:69,duration:800,lyric:"na"},
    {note:67,duration:400,lyric:"Ra"},{note:65,duration:400,lyric:"sa"},{note:64,duration:400,lyric:"ve"},{note:62,duration:800,lyric:"—"},
    {note:62,duration:400,lyric:"Ka"},{note:64,duration:400,lyric:"da"},{note:65,duration:400,lyric:"lil"},{note:67,duration:600,lyric:"ku"},
    {note:65,duration:400,lyric:"li"},{note:64,duration:400,lyric:"kha"},{note:62,duration:800,lyric:"ya"},
    {note:67,duration:500,lyric:"Kan"},{note:65,duration:400,lyric:"na"},{note:67,duration:600,lyric:"zha"},{note:69,duration:800,lyric:"ga"},
  ]},
  "Rowdy Baby":{bpm:115,emoji:"🔥",genre:"Tamil",difficulty:"Medium",language:"Tamil",description:"Maari 2 — Dhanush full song",source:"library",notes:[
    {note:64,duration:250,lyric:"Row"},{note:62,duration:250,lyric:"dy"},{note:60,duration:250,lyric:"ba"},{note:62,duration:400,lyric:"by"},
    {note:64,duration:250,lyric:"row"},{note:65,duration:250,lyric:"dy"},{note:64,duration:250,lyric:"ba"},{note:62,duration:600,lyric:"by"},
    {note:60,duration:250,lyric:"Row"},{note:62,duration:250,lyric:"dy"},{note:64,duration:250,lyric:"ba"},{note:65,duration:400,lyric:"by"},
    {note:67,duration:400,lyric:"Ne"},{note:65,duration:400,lyric:"el"},{note:64,duration:600,lyric:"la"},
    {note:65,duration:300,lyric:"Un"},{note:64,duration:300,lyric:"nak"},{note:62,duration:600,lyric:"ku"},
    {note:64,duration:250,lyric:"Row"},{note:62,duration:250,lyric:"dy"},{note:60,duration:250,lyric:"ba"},{note:62,duration:400,lyric:"by"},
    {note:69,duration:300,lyric:"Hey"},{note:67,duration:300,lyric:"hey"},{note:65,duration:600,lyric:"—"},
    {note:64,duration:300,lyric:"Maa"},{note:62,duration:300,lyric:"ri"},{note:60,duration:300,lyric:"maa"},{note:62,duration:300,lyric:"ri"},
    {note:64,duration:600,lyric:"maa"},{note:65,duration:800,lyric:"ri"},
  ]},

  // ── PUNJABI ──
  "Pasoori":{bpm:95,emoji:"🎭",genre:"Punjabi",difficulty:"Medium",language:"Punjabi",description:"Coke Studio — Ali Sethi real melody",source:"library",notes:[
    {note:59,duration:400,lyric:"Pa"},{note:60,duration:400,lyric:"soo"},{note:62,duration:700,lyric:"ri"},
    {note:60,duration:350,lyric:"Pa"},{note:59,duration:350,lyric:"soo"},{note:57,duration:700,lyric:"ri"},
    {note:55,duration:400,lyric:"Ku"},{note:57,duration:400,lyric:"ch"},{note:59,duration:400,lyric:"nai"},{note:60,duration:600,lyric:"—"},
    {note:59,duration:400,lyric:"Pa"},{note:60,duration:400,lyric:"soo"},{note:62,duration:700,lyric:"ri"},
    {note:64,duration:400,lyric:"Aa"},{note:62,duration:400,lyric:"waz"},{note:60,duration:700,lyric:"—"},
    {note:59,duration:400,lyric:"Me"},{note:57,duration:400,lyric:"ri"},{note:55,duration:800,lyric:"sang"},
    {note:59,duration:400,lyric:"Pa"},{note:60,duration:400,lyric:"soo"},{note:62,duration:700,lyric:"ri"},
    {note:60,duration:350,lyric:"Pa"},{note:59,duration:350,lyric:"soo"},{note:57,duration:800,lyric:"ri"},
  ]},

  // ── CLASSICAL ──
  "Yaman Alaap":{bpm:55,emoji:"🌙",genre:"Classical",difficulty:"Hard",language:"Hindi",description:"Raga Yaman evening — correct sargam",source:"library",notes:[
    {note:71,duration:700,lyric:"Ni"},{note:72,duration:700,lyric:"Sa"},{note:74,duration:900,lyric:"Re"},{note:72,duration:500,lyric:"Sa"},
    {note:71,duration:500,lyric:"Ni"},{note:69,duration:700,lyric:"Dha"},{note:67,duration:900,lyric:"Pa"},
    {note:66,duration:700,lyric:"Ma#"},{note:67,duration:700,lyric:"Pa"},{note:69,duration:900,lyric:"Dha"},
    {note:71,duration:700,lyric:"Ni"},{note:72,duration:1200,lyric:"Sa'"},
    {note:74,duration:700,lyric:"Re'"},{note:76,duration:700,lyric:"Ga'"},{note:74,duration:500,lyric:"Re'"},
    {note:72,duration:500,lyric:"Sa'"},{note:74,duration:700,lyric:"Re'"},{note:72,duration:500,lyric:"Sa'"},
    {note:71,duration:500,lyric:"Ni"},{note:69,duration:700,lyric:"Dha"},{note:67,duration:900,lyric:"Pa"},
    {note:66,duration:600,lyric:"Ma#"},{note:67,duration:600,lyric:"Pa"},{note:64,duration:500,lyric:"Ga"},
    {note:62,duration:500,lyric:"Re"},{note:64,duration:700,lyric:"Ga"},{note:66,duration:700,lyric:"Ma#"},
    {note:67,duration:500,lyric:"Pa"},{note:64,duration:500,lyric:"Ga"},{note:62,duration:500,lyric:"Re"},
    {note:60,duration:500,lyric:"Sa"},{note:62,duration:700,lyric:"Re"},{note:64,duration:700,lyric:"Ga"},
    {note:66,duration:900,lyric:"Ma#"},{note:67,duration:700,lyric:"Pa"},{note:72,duration:1400,lyric:"Sa'"},
  ]},
  "Bhairav Alaap":{bpm:50,emoji:"🌅",genre:"Classical",difficulty:"Hard",language:"Hindi",description:"Morning raga Bhairav — full alaap",source:"library",notes:[
    {note:60,duration:900,lyric:"Sa"},{note:61,duration:700,lyric:"Re♭"},{note:60,duration:500,lyric:"Sa"},
    {note:64,duration:900,lyric:"Ga"},{note:65,duration:700,lyric:"Ma"},{note:67,duration:900,lyric:"Pa"},
    {note:68,duration:700,lyric:"Dha♭"},{note:67,duration:500,lyric:"Pa"},{note:71,duration:700,lyric:"Ni"},
    {note:72,duration:1400,lyric:"Sa'"},
    {note:72,duration:700,lyric:"Sa'"},{note:71,duration:500,lyric:"Ni"},{note:68,duration:700,lyric:"Dha♭"},
    {note:67,duration:500,lyric:"Pa"},{note:65,duration:500,lyric:"Ma"},{note:64,duration:700,lyric:"Ga"},
    {note:61,duration:700,lyric:"Re♭"},{note:60,duration:900,lyric:"Sa"},
    {note:60,duration:500,lyric:"Sa"},{note:61,duration:500,lyric:"Re♭"},{note:64,duration:700,lyric:"Ga"},
    {note:65,duration:500,lyric:"Ma"},{note:64,duration:500,lyric:"Ga"},{note:61,duration:500,lyric:"Re♭"},
    {note:60,duration:900,lyric:"Sa"},{note:64,duration:500,lyric:"Ga"},{note:65,duration:700,lyric:"Ma"},
    {note:67,duration:500,lyric:"Pa"},{note:68,duration:700,lyric:"Dha♭"},{note:67,duration:500,lyric:"Pa"},
    {note:64,duration:500,lyric:"Ga"},{note:61,duration:700,lyric:"Re♭"},{note:60,duration:1400,lyric:"Sa"},
  ]},

  // ── WESTERN ──
  "Ode to Joy":{bpm:95,emoji:"🎼",genre:"Western",difficulty:"Easy",language:"English",description:"Beethoven Symphony 9 — complete",source:"library",notes:[
    {note:64,duration:400,lyric:"E"},{note:64,duration:400,lyric:"E"},{note:65,duration:400,lyric:"F"},{note:67,duration:400,lyric:"G"},
    {note:67,duration:400,lyric:"G"},{note:65,duration:400,lyric:"F"},{note:64,duration:400,lyric:"E"},{note:62,duration:400,lyric:"D"},
    {note:60,duration:400,lyric:"C"},{note:60,duration:400,lyric:"C"},{note:62,duration:400,lyric:"D"},{note:64,duration:400,lyric:"E"},
    {note:64,duration:600,lyric:"E"},{note:62,duration:200,lyric:"D"},{note:62,duration:800,lyric:"D"},
    {note:64,duration:400,lyric:"E"},{note:64,duration:400,lyric:"E"},{note:65,duration:400,lyric:"F"},{note:67,duration:400,lyric:"G"},
    {note:67,duration:400,lyric:"G"},{note:65,duration:400,lyric:"F"},{note:64,duration:400,lyric:"E"},{note:62,duration:400,lyric:"D"},
    {note:60,duration:400,lyric:"C"},{note:60,duration:400,lyric:"C"},{note:62,duration:400,lyric:"D"},{note:64,duration:400,lyric:"E"},
    {note:62,duration:600,lyric:"D"},{note:60,duration:200,lyric:"C"},{note:60,duration:800,lyric:"C"},
    {note:62,duration:400,lyric:"D"},{note:62,duration:400,lyric:"D"},{note:64,duration:400,lyric:"E"},{note:60,duration:400,lyric:"C"},
    {note:62,duration:400,lyric:"D"},{note:64,duration:200,lyric:"E"},{note:65,duration:200,lyric:"F"},{note:64,duration:400,lyric:"E"},
    {note:60,duration:400,lyric:"C"},{note:62,duration:400,lyric:"D"},{note:64,duration:200,lyric:"E"},{note:65,duration:200,lyric:"F"},
    {note:64,duration:400,lyric:"E"},{note:62,duration:400,lyric:"D"},{note:60,duration:400,lyric:"C"},{note:55,duration:800,lyric:"G"},
  ]},
}

async function searchSongViaAPI(query: string, authToken: string): Promise<{song: any; usage: {used:number;limit:number;remaining:number}}> {
  const res = await fetch("/api/ai-song", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`
    },
    body: JSON.stringify({ query })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}


// ── FIREWORKS ─────────────────────────────────────────────────────
function triggerFireworks() {
  const colors=["#f59e0b","#fbbf24","#10b981","#818cf8","#ec4899","#ef4444","#60a5fa","#34d399"]
  for(let b=0;b<7;b++){
    setTimeout(()=>{
      const cx=100+Math.random()*(window.innerWidth-200)
      const cy=80+Math.random()*(window.innerHeight*0.5)
      for(let i=0;i<36;i++){
        const p=document.createElement("div")
        const angle=(i/36)*Math.PI*2, spd=50+Math.random()*120
        const vx=Math.cos(angle)*spd, vy=Math.sin(angle)*spd
        const color=colors[Math.floor(Math.random()*colors.length)]
        const sz=3+Math.random()*5
        p.style.cssText=`position:fixed;left:${cx}px;top:${cy}px;width:${sz}px;height:${sz}px;border-radius:50%;background:${color};pointer-events:none;z-index:9999;box-shadow:0 0 ${sz*2}px ${color}`
        document.body.appendChild(p)
        const t0=performance.now(),dur=700+Math.random()*600,g=100
        const tick=(now:number)=>{
          const t=(now-t0)/1000
          if(t>dur/1000){p.remove();return}
          p.style.left=(cx+vx*t)+"px";p.style.top=(cy+vy*t+.5*g*t*t)+"px"
          p.style.opacity=String(Math.max(0,1-t/(dur/1000)))
          requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
      // note bursts
      const notes=["♪","♫","Sa","Re","Pa","Ga","Ma","♬"]
      for(let n=0;n<5;n++){
        const nt=document.createElement("div")
        const a=Math.random()*Math.PI*2,s=40+Math.random()*60
        const vx=Math.cos(a)*s,vy=Math.sin(a)*s-70
        nt.style.cssText=`position:fixed;left:${cx}px;top:${cy}px;color:${colors[n%colors.length]};font-size:${14+Math.random()*12}px;pointer-events:none;z-index:9999;font-weight:bold`
        nt.textContent=notes[Math.floor(Math.random()*notes.length)]
        document.body.appendChild(nt)
        const t0=performance.now()
        const tick=(now:number)=>{const t=(now-t0)/1000;if(t>1.3){nt.remove();return};nt.style.left=(cx+vx*t)+"px";nt.style.top=(cy+vy*t+.5*60*t*t)+"px";nt.style.opacity=String(Math.max(0,1-t/1.3));nt.style.transform=`rotate(${t*200}deg)`;requestAnimationFrame(tick)}
        requestAnimationFrame(tick)
      }
    },b*200)
  }
}

// ── SOUND ENGINE ─────────────────────────────────────────────────
// Shared AudioContext for all synthesized sounds
let _sharedAC: AudioContext | null = null
function getAC(): AudioContext | null {
  try {
    if (!_sharedAC || _sharedAC.state === "closed") {
      const AC = window.AudioContext || (window as any).webkitAudioContext
      _sharedAC = new AC()
    }
    if (_sharedAC.state === "suspended") _sharedAC.resume()
    return _sharedAC
  } catch { return null }
}

function playTone(freq: number, duration: number, vol = 0.15, type: OscillatorType = "sine", ctx?: AudioContext) {
  const ac = ctx || getAC()
  if (!ac) return
  try {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain); gain.connect(ac.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, ac.currentTime)
    gain.gain.setValueAtTime(0.001, ac.currentTime)
    gain.gain.linearRampToValueAtTime(vol, ac.currentTime + 0.015)
    gain.gain.setValueAtTime(vol, ac.currentTime + duration * 0.6)
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration)
    osc.start(ac.currentTime)
    osc.stop(ac.currentTime + duration + 0.05)
  } catch {}
}

// Sa Re Ga Ma Pa Dha Ni Sa' — exact harmonium frequencies in C major
const SARGAM_FREQS = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25]

function playLandingKeySound(index: number) {
  // Each key plays its sargam note — warm harmonium-like tone
  const freq = SARGAM_FREQS[index % SARGAM_FREQS.length]
  playTone(freq, 1.4, 0.16, "sine")
  // Add a faint octave above for harmonium richness
  setTimeout(() => playTone(freq * 2, 0.8, 0.05, "sine"), 10)
}

function playEnterSound() {
  // Sa → Pa → Sa' arpeggio then hold — triumphant but harmonium-style
  const arp = [261.63, 329.63, 392.00, 523.25, 659.25]
  arp.forEach((f, i) => setTimeout(() => playTone(f, 0.6, 0.18, "sine"), i * 90))
  // Warm chord bloom after arpeggio
  setTimeout(() => {
    playTone(261.63, 1.8, 0.12, "sine")
    playTone(329.63, 1.8, 0.10, "sine")
    playTone(392.00, 1.8, 0.09, "sine")
    playTone(523.25, 1.8, 0.07, "sine")
  }, arp.length * 90 + 50)
}

function playFireworkSound() {
  const ac = getAC()
  if (!ac) return
  // Deep boom on launch
  playTone(55, 0.5, 0.3, "sine", ac)
  playTone(80, 0.4, 0.2, "triangle", ac)
  // Rising burst sweep
  const burst = [523.25, 659.25, 783.99, 1046.50, 1318.51]
  burst.forEach((f, i) => setTimeout(() => {
    playTone(f, 0.4, 0.14, "sine", ac)
    playTone(f * 1.25, 0.25, 0.06, "triangle", ac)
  }, 80 + i * 55))
  // Sparkle shimmer
  for (let s = 0; s < 10; s++) {
    setTimeout(() => {
      const f = 900 + Math.random() * 1400
      playTone(f, 0.2, 0.07, "sine", ac)
    }, 250 + s * 70)
  }
  // Musical notes fly — Sa Pa Sa'
  setTimeout(() => playTone(523.25, 0.8, 0.12, "sine", ac), 400)
  setTimeout(() => playTone(392.00, 0.8, 0.10, "sine", ac), 500)
  setTimeout(() => playTone(261.63, 1.0, 0.10, "sine", ac), 600)
}

// ── AMBIENT BACKGROUND MUSIC ─────────────────────────────────────
// Tanpura-style drone: Sa + Pa + Sa' cycling slowly
let _ambientNodes: OscillatorNode[] = []
let _ambientGain: GainNode | null = null
let _ambientAC: AudioContext | null = null

let _ambientLoopTimer: ReturnType<typeof setTimeout> | null = null
let _ambientScene: "auth" | "landing" | null = null

function startAmbientMusic(scene: "auth" | "landing") {
  stopAmbientMusic()
  const ac = getAC()
  if (!ac) return
  _ambientAC = ac
  _ambientScene = scene

  const master = ac.createGain()
  master.gain.setValueAtTime(0, ac.currentTime)
  master.gain.linearRampToValueAtTime(0.07, ac.currentTime + 2.5)
  master.connect(ac.destination)
  _ambientGain = master

  // Continuous drone: Sa + Pa + Sa' (tanpura-style) — these loop forever
  const drones = scene === "auth"
    ? [130.81, 196.00, 261.63, 392.00]
    : [130.81, 196.00, 261.63, 329.63]

  _ambientNodes = []
  drones.forEach((freq, i) => {
    try {
      const osc = ac.createOscillator()
      const oscGain = ac.createGain()
      osc.type = i % 2 === 0 ? "sine" : "triangle"
      osc.frequency.setValueAtTime(freq, ac.currentTime)
      osc.detune.setValueAtTime([-3, 2, -1, 4][i] ?? 0, ac.currentTime)
      oscGain.gain.setValueAtTime([0.10, 0.05, 0.06, 0.03][i] ?? 0.04, ac.currentTime)
      osc.connect(oscGain)
      oscGain.connect(master)
      osc.start(ac.currentTime) // no stop = loops forever until stopAmbientMusic()
      _ambientNodes.push(osc)
    } catch {}
  })

  // Looping slow melody — plays one pass, then reschedules itself
  const authMelody  = [261.63, 293.66, 329.63, 293.66, 261.63, 246.94, 261.63]
  const landMelody  = [261.63, 293.66, 329.63, 392.00, 349.23, 329.63, 261.63]
  const melody = scene === "auth" ? authMelody : landMelody
  const noteDur = 2.8 // seconds per note
  const loopDur = melody.length * noteDur * 1000 // ms

  function playMelodyPass() {
    const a = _ambientAC
    const g = _ambientGain
    if(!a || !g) return
    let t = a.currentTime + 0.1
    melody.forEach((freq) => {
      try {
        const osc = a.createOscillator()
        const og = a.createGain()
        osc.type = "sine"
        osc.frequency.setValueAtTime(freq, t)
        og.gain.setValueAtTime(0, t)
        og.gain.linearRampToValueAtTime(0.055, t + 0.6)
        og.gain.setValueAtTime(0.055, t + noteDur - 0.5)
        og.gain.linearRampToValueAtTime(0, t + noteDur)
        osc.connect(og); og.connect(g)
        osc.start(t); osc.stop(t + noteDur + 0.1)
        _ambientNodes.push(osc)
      } catch {}
      t += noteDur
    })
    // Schedule next loop pass
    _ambientLoopTimer = setTimeout(() => {
      if(_ambientScene === scene) playMelodyPass()
    }, loopDur - 200)
  }

  // Start melody after drone fades in
  _ambientLoopTimer = setTimeout(playMelodyPass, 2800)
}

function stopAmbientMusic() {
  _ambientScene = null
  if(_ambientLoopTimer){ clearTimeout(_ambientLoopTimer); _ambientLoopTimer = null }
  if (_ambientGain && _ambientAC) {
    try {
      _ambientGain.gain.linearRampToValueAtTime(0, _ambientAC.currentTime + 1.5)
    } catch {}
  }
  setTimeout(() => {
    _ambientNodes.forEach(o => { try { o.stop() } catch {} })
    _ambientNodes = []
    _ambientGain = null
  }, 1600)
}

// ── MAIN COMPONENT ────────────────────────────────────────────────
export default function Swaraa() {
  // Auth state
  const [user, setUser] = useState<User|null>(null)
  const [profile, setProfile] = useState<{role:string}|null>(null)
  const [authView, setAuthView] = useState<"login"|"signup">("login")
  const [authLoading, setAuthLoading] = useState(true)
  const [authForm, setAuthForm] = useState({email:"",password:"",name:""})
  const [authError, setAuthError] = useState("")

  // App phase
  const [phase, setPhase] = useState<"landing"|"app">("landing")
  const [landingStep, setLandingStep] = useState(0)

  // Audio
  const [volume, setVolume] = useState(80)
  const [useReverb, setUseReverb] = useState(false)
  const [transpose, setTranspose] = useState(0)
  const [currentOctave, setCurrentOctave] = useState(3)
  const [additionalReeds, setAdditionalReeds] = useState(0)
  const [bassEQ, setBassEQ] = useState(0)
  const [trebleEQ, setTrebleEQ] = useState(0)
  const [midiSupported, setMidiSupported] = useState(false)
  const [midiDevices, setMidiDevices] = useState<any[]>([])
  const [selectedMidi, setSelectedMidi] = useState("")

  // UI state
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set())
  const [selectedRaga, setSelectedRaga] = useState("Free")
  const [showSettings, setShowSettings] = useState(false)
  const [activeSection, setActiveSection] = useState<"search"|"practice"|"your-songs"|"admin">("search")
  const [toast, setToast] = useState<{msg:string;type?:string}|null>(null)
  const [noteHistory, setNoteHistory] = useState<string[]>([])
  const [sessionNotes, setSessionNotes] = useState(0)

  // Search & Songs
  const [searchQ, setSearchQ] = useState("")
  const [songLibrary, setSongLibrary] = useState<Record<string,Song>>(SONGS)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string|null>(null)
  const [aiUsage, setAiUsage] = useState<{used:number;limit:number;remaining:number}|null>(null)
  const [genreFilter, setGenreFilter] = useState("All")

  // Practice
  const [activeSheet, setActiveSheet] = useState<string|null>(null)
  const [activeGuide, setActiveGuide] = useState<string|null>(null)
  const [guideStep, setGuideStep] = useState(0)
  const [correctHits, setCorrectHits] = useState(0)
  const [wrongHits, setWrongHits] = useState(0)
  const [hitFeedback, setHitFeedback] = useState<"correct"|"wrong"|null>(null)
  const [guideListenActive, setGuideListenActive] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [isPlayingSong, setIsPlayingSong] = useState(false)
  const [playingSongName, setPlayingSongName] = useState<string|null>(null)

  // Recording
  const [recordMode, setRecordMode] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([])
  const [recordName, setRecordName] = useState("")
  const [playingBack, setPlayingBack] = useState(false)
  const [savedRecordings, setSavedRecordings] = useState<SavedRecording[]>([])
  const [loadingRecordings, setLoadingRecordings] = useState(false)

  // Admin
  const [adminUsers, setAdminUsers] = useState<any[]>([])
  const [adminLoading, setAdminLoading] = useState(false)

  // Refs
  const audioCtx = useRef<AudioContext|null>(null)
  const audioBuf = useRef<AudioBuffer|null>(null)
  const reverbBuf = useRef<AudioBuffer|null>(null)
  const gainNode = useRef<GainNode|null>(null)
  const reverbNode = useRef<ConvolverNode|null>(null)
  const bassF = useRef<BiquadFilterNode|null>(null)
  const trebleF = useRef<BiquadFilterNode|null>(null)
  const srcNodes = useRef<(AudioBufferSourceNode|null)[]>([])
  const srcState = useRef<number[]>([])
  const droneRef = useRef<AudioBufferSourceNode|null>(null)
  const [droneNote, setDroneNote] = useState<number|null>(null)
  const recStart = useRef(0)
  const pTOs = useRef<ReturnType<typeof setTimeout>[]>([])
  const kMap = useRef<number[]>([])
  const guideStepRef = useRef(0)
  const guideListenRef = useRef(false)
  const octaveMap = [-36,-24,-12,0,12,24,36]

  const showToast = useCallback((msg:string,type="info")=>{
    setToast({msg,type}); setTimeout(()=>setToast(null),2800)
  },[])

  // ── AUTH ─────────────────────────────────────────────────────────
  useEffect(()=>{
    supabase.auth.getSession().then(({data:{session}})=>{
      setUser(session?.user??null); setAuthLoading(false)
      if(session?.user) loadProfile(session.user.id)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_,session)=>{
      setUser(session?.user??null)
      if(session?.user){
        loadProfile(session.user.id)
        stopAmbientMusic() // stop auth music when logged in
      } else {
        setProfile(null)
      }
    })
    return()=>subscription.unsubscribe()
  },[])

  // Ambient music — must start AFTER user interaction (browser autoplay policy)
  // We attach a one-time listener on the auth page; first click/key starts music
  useEffect(()=>{
    if(user || authLoading) return
    let started = false
    const startOnInteraction = () => {
      if(started) return
      started = true
      startAmbientMusic("auth")
    }
    document.addEventListener("click", startOnInteraction, { once: true })
    document.addEventListener("keydown", startOnInteraction, { once: true })
    document.addEventListener("touchstart", startOnInteraction, { once: true })
    return()=>{
      document.removeEventListener("click", startOnInteraction)
      document.removeEventListener("keydown", startOnInteraction)
      document.removeEventListener("touchstart", startOnInteraction)
      stopAmbientMusic()
    }
  },[user, authLoading])

  const loadProfile=async(uid:string)=>{
    const{data}=await supabase.from("profiles").select("role").eq("id",uid).single()
    if(data) setProfile(data)
  }

  const handleSignup=async()=>{
    if(!authForm.email||!authForm.password){setAuthError("Email and password required");return}
    setAuthLoading(true);setAuthError("")
    const{error}=await supabase.auth.signUp({email:authForm.email,password:authForm.password})
    if(error)setAuthError(error.message)
    else showToast("Account created! Check email to verify.","success")
    setAuthLoading(false)
  }

  const handleLogin=async()=>{
    if(!authForm.email||!authForm.password){setAuthError("Email and password required");return}
    setAuthLoading(true);setAuthError("")
    const{error}=await supabase.auth.signInWithPassword({email:authForm.email,password:authForm.password})
    if(error)setAuthError(error.message)
    setAuthLoading(false)
  }

  const handleLogout=async()=>{
    stopPB()
    if(droneRef.current){try{droneRef.current.stop()}catch{};droneRef.current=null;setDroneNote(null)}
    stopAll()
    await supabase.auth.signOut()
    // user becomes null → auth screen shows automatically, no need to setPhase
    setPhase("landing") // reset so next login starts from landing
    setLandingStep(0)
    // toast won't show since we're on auth screen, skip it
  }

  // ── RECORDINGS (Supabase) ─────────────────────────────────────────
  const loadRecordings=useCallback(async()=>{
    if(!user)return; setLoadingRecordings(true)
    const{data}=await supabase.from("recordings").select("*").eq("user_id",user.id).order("created_at",{ascending:false})
    if(data)setSavedRecordings(data)
    setLoadingRecordings(false)
  },[user])

  useEffect(()=>{ if(user&&activeSection==="your-songs")loadRecordings() },[user,activeSection,loadRecordings])

  const saveRecording=async()=>{
    if(!user||!recordName.trim()||recordedNotes.length===0){showToast("Add a name first","warn");return}
    const dur=recordedNotes.length>0?recordedNotes[recordedNotes.length-1].time:0
    const{data,error}=await supabase.from("recordings").insert({user_id:user.id,name:recordName.trim(),notes:recordedNotes,duration_ms:dur}).select().single()
    if(error){showToast("Save failed: "+error.message,"error");return}
    setSavedRecordings(p=>[data,...p])
    setRecordedNotes([]);setRecordName("");setRecordMode(false)
    showToast("Recording saved! ✅");setActiveSection("your-songs")
  }

  const deleteRecording=async(id:string)=>{
    stopPB()  // stop any playing audio first
    await supabase.from("recordings").delete().eq("id",id)
    setSavedRecordings(p=>p.filter(r=>r.id!==id))
    showToast("Deleted")
  }

  // ── AI SONGS (Supabase) ───────────────────────────────────────────
  const loadAISongs=useCallback(async()=>{
    if(!user)return
    const{data}=await supabase.from("ai_songs").select("*").eq("user_id",user.id)
    if(data){
      const extra:Record<string,Song>={}
      data.forEach((r:any)=>{extra[r.name]=r.song_data})
      setSongLibrary(p=>({...SONGS,...extra}))
    }
  },[user])

  useEffect(()=>{ if(user)loadAISongs() },[user,loadAISongs])

  // Save gemini key to profile


  // ── ADMIN ─────────────────────────────────────────────────────────
  const loadAdminData=useCallback(async()=>{
    if(profile?.role!=="admin")return
    setAdminLoading(true)
    const{data}=await supabase.from("profiles").select("id,email,role,created_at")
    if(data)setAdminUsers(data)
    setAdminLoading(false)
  },[profile])

  useEffect(()=>{ if(activeSection==="admin")loadAdminData() },[activeSection,loadAdminData])

  const setUserRole=async(uid:string,role:string)=>{
    await supabase.from("profiles").update({role}).eq("id",uid)
    setAdminUsers(p=>p.map(u=>u.id===uid?{...u,role}:u))
    showToast(`Role updated to ${role}`)
  }

  // ── LANDING ───────────────────────────────────────────────────────
  useEffect(()=>{
    if(phase!=="landing"||!user)return
    // Animate landing steps
    const steps=[200,700,1300,2000]
    steps.forEach((t,i)=>setTimeout(()=>setLandingStep(i+1),t))

    // Landing page: user arrived here from auth (they already clicked login)
    // so AudioContext is allowed. Play key sounds then ambient.
    // Small delay to let React render first
    const initTimer = setTimeout(()=>{
      // Unlock AudioContext first
      const ac = getAC()
      if(ac?.state === "suspended") ac.resume()

      // Key sounds: Sa Re Ga Ma Pa Dha Ni Sa'
      const keyDelays=[800,1000,1200,1400,1600,1800,2000,2200]
      keyDelays.forEach((t,i)=>setTimeout(()=>playLandingKeySound(i),t))

      // Ambient music starts after key sounds finish
      setTimeout(()=>startAmbientMusic("landing"), 2700)
    }, 100)

    return()=>clearTimeout(initTimer)
  },[phase,user])

  // ── AUDIO ────────────────────────────────────────────────────────
  const initKMap=useCallback(()=>{
    const s=60-124+(62-60)
    for(let i=0;i<128;i++){kMap.current[i]=s+i+transpose}
  },[transpose])

  const stopAll=useCallback(()=>{
    for(let i=0;i<srcNodes.current.length;i++){
      if(srcNodes.current[i]&&srcState.current[i]===1){try{srcNodes.current[i]!.stop(0)}catch{};srcState.current[i]=0}
    }
  },[])

  const setSrcNode=useCallback((idx:number)=>{
    if(!audioCtx.current||!audioBuf.current||!bassF.current)return
    if(srcNodes.current[idx]&&srcState.current[idx]===1){try{srcNodes.current[idx]!.stop(0)}catch{};srcState.current[idx]=0}
    const s=audioCtx.current.createBufferSource()
    s.buffer=audioBuf.current;s.loop=true;s.loopStart=0.5;s.loopEnd=7.5
    if(kMap.current[idx]!==0)s.detune.value=kMap.current[idx]*100
    s.connect(bassF.current);srcNodes.current[idx]=s
  },[kMap])

  const initSrcNodes=useCallback(()=>{
    if(!audioCtx.current||!audioBuf.current)return
    stopAll();srcNodes.current=new Array(128).fill(null);srcState.current=new Array(128).fill(0)
    for(let i=0;i<128;i++)setSrcNode(i)
  },[stopAll,setSrcNode])

  const noteOn=useCallback((note:number,auto=false)=>{
    if(selectedRaga!=="Free"){const n=((note%12)+12)%12;if(!RAGAS[selectedRaga].notes.includes(n))return}
    const idx=note+octaveMap[currentOctave]
    if(idx>=0&&idx<srcNodes.current.length&&srcState.current[idx]===0){srcNodes.current[idx]?.start(0);srcState.current[idx]=1}
    for(let c=1;c<=additionalReeds;c++){const ai=note+octaveMap[Math.min(6,currentOctave+c)];if(ai>=0&&ai<srcNodes.current.length&&srcState.current[ai]===0){srcNodes.current[ai]?.start(0);srcState.current[ai]=1}}
    setPressedKeys(p=>new Set(p).add(note));setSessionNotes(n=>n+1)
    setNoteHistory(p=>[getSargam(note),...p].slice(0,8))
    if(isRecording&&!auto){const t=Date.now()-recStart.current;setRecordedNotes(p=>[...p,{note,time:t,type:"on"}])}
    if(!auto&&activeGuide&&songLibrary[activeGuide]){
      const song=songLibrary[activeGuide];const step=guideStepRef.current
      if(step<song.notes.length){
        const exp=song.notes[step].note
        if(note===exp||note===exp-12||note===exp+12){
          setHitFeedback("correct");setCorrectHits(h=>h+1)
          const next=step+1;guideStepRef.current=next;setGuideStep(next)
          if(next>=song.notes.length){setTimeout(()=>{setShowCelebration(true);triggerFireworks();playFireworkSound();setTimeout(()=>setShowCelebration(false),6000)},200)}
          setTimeout(()=>setHitFeedback(null),350)
        } else {setHitFeedback("wrong");setWrongHits(h=>h+1);setTimeout(()=>setHitFeedback(null),300)}
      }
    }
  },[currentOctave,additionalReeds,selectedRaga,activeGuide,songLibrary,isRecording])

  const noteOff=useCallback((note:number,auto=false)=>{
    const idx=note+octaveMap[currentOctave]
    if(idx>=0&&idx<srcNodes.current.length)setSrcNode(idx)
    for(let c=1;c<=additionalReeds;c++){const ai=note+octaveMap[Math.min(6,currentOctave+c)];if(ai>=0&&ai<srcNodes.current.length)setSrcNode(ai)}
    setPressedKeys(p=>{const n=new Set(p);n.delete(note);return n})
    if(isRecording&&!auto){const t=Date.now()-recStart.current;setRecordedNotes(p=>[...p,{note,time:t,type:"off"}])}
  },[currentOctave,additionalReeds,setSrcNode,isRecording])

  useEffect(()=>{
    const init=async()=>{
      try{
        const AC=window.AudioContext||(window as any).webkitAudioContext
        audioCtx.current=new AC()
        bassF.current=audioCtx.current.createBiquadFilter();bassF.current.type="lowshelf";bassF.current.frequency.value=200
        trebleF.current=audioCtx.current.createBiquadFilter();trebleF.current.type="highshelf";trebleF.current.frequency.value=4000
        gainNode.current=audioCtx.current.createGain();gainNode.current.gain.value=volume/100
        bassF.current.connect(trebleF.current);trebleF.current.connect(gainNode.current);gainNode.current.connect(audioCtx.current.destination)
        reverbNode.current=audioCtx.current.createConvolver();reverbNode.current.connect(audioCtx.current.destination)
        try{const r=await fetch("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/harmonium-kannan-orig-6DIgVWUXlXjskJRcrUvRNLUBNigcyy.wav");if(r.ok)audioBuf.current=await audioCtx.current.decodeAudioData(await r.arrayBuffer())}catch{}
        try{const rv=await fetch("https://hebbkx1anhila5yf.public.blob.vercel-storage.com/reverb-OkQQ8iqL5OAhhMOQOXryBDa6TDHb1a.wav");if(rv.ok){reverbBuf.current=await audioCtx.current.decodeAudioData(await rv.arrayBuffer());reverbNode.current.buffer=reverbBuf.current}}catch{}
        initKMap();initSrcNodes()
        // MIDI
        if(typeof navigator!=="undefined"&&typeof (navigator as any).requestMIDIAccess==="function"){
          try{
            const ma=await (navigator as any).requestMIDIAccess({sysex:false});setMidiSupported(true)
            const devs:any[]=[]
            for(const inp of ma.inputs.values()){devs.push({id:inp.id,name:inp.name});inp.onmidimessage=(msg:any)=>{const[cmd,note,vel=0]=msg.data;if(cmd===144&&vel>0)noteOn(note);else if(cmd===128||(cmd===144&&vel===0))noteOff(note)}}
            setMidiDevices(devs)
          }catch{}
        }
      }catch{}
    }
    init()
  },[])

  const handleKD=useCallback((e:KeyboardEvent)=>{
    if(e.repeat||phase==="landing")return
    if(e.altKey&&!e.ctrlKey){e.preventDefault();if(e.key==="ArrowUp")setVolume(v=>Math.min(100,v+5));if(e.key==="ArrowDown")setVolume(v=>Math.max(0,v-5));return}
    if(KB[e.key]!==undefined)noteOn(KB[e.key])
  },[phase,noteOn])
  const handleKU=useCallback((e:KeyboardEvent)=>{if(phase==="landing")return;if(KB[e.key]!==undefined)noteOff(KB[e.key])},[phase,noteOff])
  useEffect(()=>{window.addEventListener("keydown",handleKD);window.addEventListener("keyup",handleKU);return()=>{window.removeEventListener("keydown",handleKD);window.removeEventListener("keyup",handleKU)}},[handleKD,handleKU])
  useEffect(()=>{if(gainNode.current)gainNode.current.gain.value=volume/100},[volume])
  useEffect(()=>{if(bassF.current)bassF.current.gain.value=bassEQ},[bassEQ])
  useEffect(()=>{if(trebleF.current)trebleF.current.gain.value=trebleEQ},[trebleEQ])
  useEffect(()=>{initKMap();initSrcNodes()},[transpose])
  useEffect(()=>{if(!audioCtx.current)return;stopAll();initSrcNodes()},[currentOctave,additionalReeds])
  useEffect(()=>{if(gainNode.current&&reverbNode.current){if(useReverb){try{gainNode.current.connect(reverbNode.current)}catch{}}else{try{gainNode.current.disconnect(reverbNode.current)}catch{}}}},[useReverb])
  useEffect(()=>{const f=()=>stopAll();window.addEventListener("blur",f);return()=>window.removeEventListener("blur",f)},[stopAll])

  const getRootNote=()=>["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"][transpose>=0?transpose%12:transpose+12]

  const startDrone=(note:number)=>{
    if(!audioCtx.current||!audioBuf.current||!bassF.current)return
    if(droneRef.current){try{droneRef.current.stop()}catch{}}
    if(droneNote===note){setDroneNote(null);droneRef.current=null;return}
    const s=audioCtx.current.createBufferSource();s.buffer=audioBuf.current;s.loop=true;s.loopStart=0.5;s.loopEnd=7.5
    const g=audioCtx.current.createGain();g.gain.value=0.35;s.connect(g);g.connect(bassF.current);s.start()
    droneRef.current=s;setDroneNote(note);showToast(`Drone: ${getSargam(note)}`)
  }

  const stopPB=useCallback(()=>{
    pTOs.current.forEach(t=>clearTimeout(t))
    pTOs.current=[]
    stopAll()
    initSrcNodes()
    setIsPlayingSong(false)
    setPlayingSongName(null)
    setPlayingBack(false)
  },[stopAll,initSrcNodes])

  const playSong=(name:string,songNotes?:SongNote[])=>{
    if(isPlayingSong){stopPB();return}
    const notes=songNotes||songLibrary[name]?.notes;if(!notes)return
    setPlayingSongName(name);setIsPlayingSong(true);showToast(`▶ ${name}`)
    const tos:ReturnType<typeof setTimeout>[]=[];let t=0
    notes.forEach(ev=>{tos.push(setTimeout(()=>noteOn(ev.note,true),t));tos.push(setTimeout(()=>noteOff(ev.note,true),t+ev.duration*0.9));t+=ev.duration})
    tos.push(setTimeout(()=>{setIsPlayingSong(false);setPlayingSongName(null);setPlayingBack(false)},t+300))
    pTOs.current=tos
  }

  const playRecordingBack=(notes:RecordedNote[])=>{
    if(playingBack){stopPB();return}
    setPlayingBack(true);showToast("▶ Playing recording")
    const tos:ReturnType<typeof setTimeout>[]=[]
    notes.forEach(ev=>{tos.push(setTimeout(()=>{if(ev.type==="on")noteOn(ev.note,true);else noteOff(ev.note,true)},ev.time))})
    const last=notes[notes.length-1]
    tos.push(setTimeout(()=>{setPlayingBack(false);showToast("⏹ Done")},last.time+500))
    pTOs.current=tos
  }

  const openSheet=(name:string)=>{setActiveSheet(name);setActiveGuide(null);setActiveSection("practice")}
  const openGuide=(name:string)=>{setActiveGuide(name);setActiveSheet(null);setGuideStep(0);guideStepRef.current=0;setCorrectHits(0);setWrongHits(0);setHitFeedback(null);setActiveSection("practice");showToast(`🎯 ${name} — play the green key!`)}
  const closePractice=()=>{setActiveSheet(null);setActiveGuide(null);setGuideStep(0);guideStepRef.current=0}
  const resetGuide=()=>{setGuideStep(0);guideStepRef.current=0;setCorrectHits(0);setWrongHits(0);setHitFeedback(null);setShowCelebration(false)}

  const playGuideStep=useCallback(()=>{
    if(!activeGuide)return;const song=songLibrary[activeGuide];if(!song)return
    const step=guideStepRef.current;if(step>=song.notes.length)return
    const ev=song.notes[step];noteOn(ev.note,true);setTimeout(()=>noteOff(ev.note,true),ev.duration*0.8)
    setTimeout(()=>{const next=step+1;guideStepRef.current=next;setGuideStep(next);if(guideListenRef.current&&next<song.notes.length)setTimeout(playGuideStep,ev.duration+80);else{setGuideListenActive(false);guideListenRef.current=false}},ev.duration)
  },[activeGuide,songLibrary,noteOn,noteOff])

  const toggleListen=()=>{
    if(guideListenActive){guideListenRef.current=false;setGuideListenActive(false);stopAll();initSrcNodes()}
    else{guideListenRef.current=true;setGuideListenActive(true);playGuideStep()}
  }

  const handleAI=async(q:string)=>{
    if(!user){showToast("Please sign in to use AI search","warn");return}
    setAiLoading(true);setAiError(null);showToast(`🔍 Searching for "${q}"...`)
    try{
      // Get current session token to authenticate with our API route
      const{data:{session}}=await supabase.auth.getSession()
      if(!session?.access_token)throw new Error("Session expired — please sign in again")
      const{song,usage}=await searchSongViaAPI(q,session.access_token)
      const name=q.trim()
      setSongLibrary(p=>({...p,[name]:song}))
      setAiUsage(usage)
      if(user){await supabase.from("ai_songs").upsert({user_id:user.id,name,song_data:song},{onConflict:"user_id,name"})}
      setActiveSheet(name);setActiveSection("practice")
      showToast(`"${name}" found! (${usage.remaining} searches left today) ✅`)
    }catch(e:any){
      const msg=e.message||""
      if(msg.includes("Daily limit")){
        setAiError(msg)
        showToast("Daily limit reached","warn")
      } else {
        setAiError(msg||"Search failed — try again")
        showToast("AI search failed","error")
      }
    }finally{setAiLoading(false)}
  }

  const searchResults=searchQ.trim()?Object.keys(songLibrary).filter(n=>{const s=songLibrary[n];const q=searchQ.toLowerCase();return n.toLowerCase().includes(q)||s.genre?.toLowerCase().includes(q)||s.language?.toLowerCase().includes(q)||s.description?.toLowerCase().includes(q)}):[]

  // ── PIANO KEYS BUILD ──────────────────────────────────────────────
  const buildKeys=()=>{
    // 3 octaves: F3→B5 = 21 white keys, 14 black keys
    // White: ` q w e r t y u i o p [ ] \ z x c v b n m
    // Black: 1 2 4 5 7 8 9 - = (first octave), then shift variants for higher octaves
    const layout:Array<{type:"w"|"b";midi:number;kchar:string}> = [
      // ── Octave 1: F3-E4 ──
      {type:"w",midi:53,kchar:"`"},   // F3  Sa
      {type:"b",midi:54,kchar:"1"},   // F#3
      {type:"w",midi:55,kchar:"q"},   // G3  Re
      {type:"b",midi:56,kchar:"2"},   // G#3
      {type:"w",midi:57,kchar:"w"},   // A3  Ga
      {type:"w",midi:58,kchar:"e"},   // A#3 Ga#
      {type:"b",midi:59,kchar:"4"},   // B3
      {type:"w",midi:60,kchar:"r"},   // C4  Sa (middle)
      {type:"b",midi:61,kchar:"5"},   // C#4
      {type:"w",midi:62,kchar:"t"},   // D4  Re
      {type:"b",midi:63,kchar:"7"},   // D#4
      {type:"w",midi:64,kchar:"y"},   // E4  Ga
      // ── Octave 2: F4-E5 ──
      {type:"w",midi:65,kchar:"u"},   // F4  Ma
      {type:"b",midi:66,kchar:"8"},   // F#4
      {type:"w",midi:67,kchar:"i"},   // G4  Pa
      {type:"b",midi:68,kchar:"9"},   // G#4
      {type:"w",midi:69,kchar:"o"},   // A4  Dha
      {type:"b",midi:70,kchar:"-"},   // A#4
      {type:"w",midi:71,kchar:"p"},   // B4  Ni
      {type:"w",midi:72,kchar:"["},   // C5  Sa'
      {type:"b",midi:73,kchar:"="},   // C#5
      {type:"w",midi:74,kchar:"]"},   // D5  Re'
      {type:"b",midi:75,kchar:""},    // D#5
      {type:"w",midi:76,kchar:"\\"},// E5  Ga'
      // ── Octave 3: F5-E6 ──
      {type:"w",midi:77,kchar:"z"},   // F5  Ma'
      {type:"b",midi:78,kchar:""},    // F#5
      {type:"w",midi:79,kchar:"x"},   // G5  Pa'
      {type:"b",midi:80,kchar:""},    // G#5
      {type:"w",midi:81,kchar:"c"},   // A5  Dha'
      {type:"w",midi:82,kchar:""},    // A#5
      {type:"b",midi:83,kchar:""},    // B5
      {type:"w",midi:84,kchar:"v"},   // C6  Sa''
    ]
    return layout.map(k=>({
      ...k,
      label: SARGAM[((k.midi%12)+12)%12],
      nin: ((k.midi%12)+12)%12
    }))
  }
    const allKeys=buildKeys();const wKeys=allKeys.filter(k=>k.type==="w");const bKeys=allKeys.filter(k=>k.type==="b")
  const isGuideKey=(midi:number)=>{
    if(!activeGuide||!songLibrary[activeGuide])return false
    const song=songLibrary[activeGuide];if(guideStep>=song.notes.length)return false
    const exp=song.notes[guideStep].note;return midi===exp||midi===exp-12||midi===exp+12
  }

  const G="#f59e0b",Gd="rgba(245,158,11,0.1)",Gb="rgba(245,158,11,0.18)"
  const diffColor=(d:string)=>d==="Easy"?"#10b981":d==="Medium"?G:"#ef4444"
  const allGenres=["All",...Array.from(new Set(Object.values(songLibrary).map(s=>s.genre)))]
  const filteredSongs=Object.keys(songLibrary).filter(n=>genreFilter==="All"||songLibrary[n].genre===genreFilter)

  // ════════════════════════════════════════════════════════════════
  // ── AUTH SCREEN ──────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  if(authLoading) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#06040f"}}>
      <div className="spin" style={{width:40,height:40,border:"3px solid rgba(245,158,11,0.2)",borderTopColor:"#f59e0b",borderRadius:"50%"}}/>
    </div>
  )

  if(!user) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse at 50% 0%,#1a0e04,#06040f 60%)"}}>
      {/* floating notes */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        {[..."♪♫♬♩𝄞♭"].map((n,i)=>(
          <div key={i} style={{position:"absolute",fontSize:"20px",color:G,opacity:0.15,left:`${10+i*16}%`,bottom:"-10px",animation:`float-note ${5+i}s linear ${i*1.2}s infinite`}}>{n}</div>
        ))}
      </div>
      <div style={{width:"100%",maxWidth:420,padding:"0 20px",animation:"slide-in-up 0.5s ease"}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div className="swaraa-gold" style={{fontSize:52,fontWeight:900,letterSpacing:"-0.02em",marginBottom:8}}>Swaraa</div>
          <div style={{fontSize:13,color:"rgba(232,223,200,0.4)",letterSpacing:"0.2em",fontFamily:"'Inter',sans-serif"}}>WHERE EVERY NOTE BREATHES</div>
        </div>
        {/* Auth card */}
        <div style={{background:"rgba(255,255,255,0.04)",border:`1px solid ${Gb}`,borderRadius:20,padding:"32px 28px",backdropFilter:"blur(20px)"}}>
          {/* Toggle */}
          <div style={{display:"flex",background:"rgba(0,0,0,0.3)",borderRadius:12,padding:4,marginBottom:28,gap:4}}>
            {(["login","signup"] as const).map(v=>(
              <button key={v} onClick={()=>{setAuthView(v);setAuthError("")}} style={{flex:1,padding:"10px",borderRadius:9,border:"none",fontWeight:600,fontSize:13,transition:"all 0.2s",background:authView===v?"linear-gradient(135deg,#f59e0b,#b45309)":"transparent",color:authView===v?"#0e0b18":"rgba(232,223,200,0.45)",cursor:"pointer"}}>
                {v==="login"?"Sign In":"Create Account"}
              </button>
            ))}
          </div>
          {/* Fields */}
          <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:20}}>
            <input type="email" placeholder="Email address" value={authForm.email} onChange={e=>setAuthForm(f=>({...f,email:e.target.value}))}
              style={{padding:"13px 16px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1px solid ${authError?"rgba(239,68,68,0.4)":Gb}`,color:"#e8dfc8",fontSize:14}} />
            <input type="password" placeholder="Password" value={authForm.password} onChange={e=>setAuthForm(f=>({...f,password:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&(authView==="login"?handleLogin():handleSignup())}
              style={{padding:"13px 16px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1px solid ${authError?"rgba(239,68,68,0.4)":Gb}`,color:"#e8dfc8",fontSize:14}} />
          </div>
          {authError&&<div style={{padding:"10px 14px",borderRadius:10,background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:12,marginBottom:16,border:"1px solid rgba(239,68,68,0.2)"}}>{authError}</div>}
          <button onClick={authView==="login"?handleLogin:handleSignup} disabled={authLoading}
            style={{width:"100%",padding:"14px",borderRadius:13,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",fontSize:14,fontWeight:700,border:"none",cursor:"pointer",boxShadow:"0 4px 20px rgba(245,158,11,0.3)",opacity:authLoading?0.7:1}}>
            {authLoading?<span className="spin" style={{display:"inline-block",width:18,height:18,border:"2px solid rgba(14,11,24,0.3)",borderTopColor:"#0e0b18",borderRadius:"50%"}}/>:authView==="login"?"Sign In →":"Create Account →"}
          </button>
          {authView==="login"&&<p style={{textAlign:"center",fontSize:12,color:"rgba(232,223,200,0.3)",marginTop:16}}>
            Don't have an account? <button onClick={()=>{setAuthView("signup");setAuthError("")}} style={{background:"none",border:"none",color:G,cursor:"pointer",fontSize:12}}>Sign up</button>
          </p>}
        </div>
        <p style={{textAlign:"center",fontSize:11,color:"rgba(232,223,200,0.2)",marginTop:20}}>© Swaraa — where every note breathes</p>
      </div>
      <style>{`@keyframes float-note{0%{transform:translateY(0) rotate(0deg);opacity:0}15%{opacity:.7}85%{opacity:.2}100%{transform:translateY(-100vh) rotate(540deg);opacity:0}}@keyframes slide-in-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )

  // ════════════════════════════════════════════════════════════════
  // ── LANDING PAGE ─────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  if(phase==="landing") {
    const lKeys=[{n:60,l:"Sa"},{n:62,l:"Re"},{n:64,l:"Ga"},{n:65,l:"Ma"},{n:67,l:"Pa"},{n:69,l:"Dha"},{n:71,l:"Ni"},{n:72,l:"Sa'"}]
    return (
      <div style={{height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:"radial-gradient(ellipse at 50% -10%,#1a0e04 0%,#06040f 65%)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          {[...Array(5)].map((_,i)=><div key={i} style={{position:"absolute",borderRadius:"50%",width:`${150+i*60}px`,height:`${150+i*60}px`,left:`${5+i*20}%`,top:`${5+i*15}%`,background:`radial-gradient(circle,hsla(${30+i*18},85%,55%,0.06),transparent 70%)`,animation:`pulse-soft ${3+i}s ease-in-out ${i*0.8}s infinite`}}/>)}
          {[..."♪♫♬♩𝄞♭♯"].map((n,i)=><div key={i} style={{position:"absolute",fontSize:"22px",color:G,opacity:0.2,left:`${8+i*14}%`,bottom:"-10px",animation:`float-note ${6+i}s linear ${i*0.9}s infinite`}}>{n}</div>)}
        </div>
        {/* Harmonium */}
        <div style={{opacity:landingStep>=1?1:0,transform:landingStep>=1?"scale(1)":"scale(0.85)",transition:"all 0.8s ease",marginBottom:44}}>
          <div style={{background:"linear-gradient(180deg,#1a0e04,#0c0702)",borderRadius:20,border:"2px solid rgba(139,90,43,0.5)",padding:"16px 20px 18px",boxShadow:"0 0 60px rgba(245,158,11,0.08),0 30px 80px rgba(0,0,0,0.6)"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingBottom:10,borderBottom:"1px solid rgba(100,60,20,0.4)",marginBottom:14}}>
              <span style={{fontSize:10,letterSpacing:"0.18em",color:"rgba(200,150,80,0.5)",fontWeight:500}}>SWARAA</span>
              <div style={{display:"flex",gap:4}}>{[...Array(8)].map((_,i)=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:`hsl(${28+i*7},76%,${44+i*4}%)`}}/>)}</div>
              <span style={{fontSize:10,color:"rgba(180,130,70,0.4)"}}>where every note breathes</span>
            </div>
            <div style={{display:"flex",gap:2}}>
              {lKeys.map((k,i)=>(
                <div key={i} style={{width:52,height:108,borderRadius:"0 0 10px 10px",background:"linear-gradient(180deg,#fffef8,#f5f0e0 70%,#e8dfc8)",border:"1.5px solid #c8b898",display:"flex",alignItems:"flex-end",justifyContent:"center",paddingBottom:10,animation:landingStep>=2?`landing-key 1.8s ease-in-out ${i*0.15}s infinite`:"none",opacity:landingStep>=2?1:0,transition:`opacity 0.4s ${i*0.08}s`}}>
                  <span style={{fontSize:10,fontWeight:700,color:"#5a3010"}}>{k.l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{height:20,background:"radial-gradient(ellipse at 50%,rgba(245,158,11,0.2),transparent 70%)",filter:"blur(8px)",marginTop:-4}}/>
        </div>
        {/* Title */}
        <div style={{textAlign:"center",marginBottom:36,opacity:landingStep>=2?1:0,transition:"opacity 0.8s 0.2s"}}>
          <div className="swaraa-gold" style={{fontSize:"clamp(56px,9vw,88px)",fontWeight:900,lineHeight:1,animation:landingStep>=2?"title-reveal 1s ease forwards":"none"}}>Swaraa</div>
          <div style={{fontSize:13,color:"rgba(232,223,200,0.4)",letterSpacing:"0.22em",marginTop:10,opacity:landingStep>=3?1:0,transition:"opacity 0.8s"}}>WHERE EVERY NOTE BREATHES</div>
        </div>
        {/* Pills */}
        <div style={{display:"flex",flexWrap:"wrap",gap:8,justifyContent:"center",maxWidth:520,marginBottom:44,opacity:landingStep>=3?1:0,transition:"opacity 0.8s 0.15s"}}>
          {["60+ Songs","Gemini AI","Raga Mode","Guided Practice","Your Recordings","MIDI","Fireworks 🎆"].map(f=>(
            <span key={f} style={{padding:"5px 14px",borderRadius:20,background:Gd,border:`1px solid ${Gb}`,fontSize:12,color:G,fontWeight:500}}>{f}</span>
          ))}
        </div>
        {/* Enter button */}
        <button onClick={()=>{stopAmbientMusic();playEnterSound();setTimeout(()=>setPhase("app"),100)}} style={{padding:"16px 56px",borderRadius:16,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",fontSize:16,fontWeight:700,border:"none",cursor:"pointer",letterSpacing:"0.04em",opacity:landingStep>=4?1:0,transform:landingStep>=4?"scale(1)":"scale(0.9)",transition:"all 0.4s 0.1s",boxShadow:"0 4px 30px rgba(245,158,11,0.35)"}}>
          Enter Swaraa ♪
        </button>
        <p style={{fontSize:12,color:"rgba(232,223,200,0.2)",marginTop:20}}>Hello, {user.email?.split("@")[0]} ✦</p>
        <style>{`@keyframes landing-key{0%,100%{transform:translateY(0);filter:brightness(1)}50%{transform:translateY(-8px);filter:brightness(1.3) drop-shadow(0 0 10px rgba(245,158,11,.7))}}@keyframes title-reveal{from{opacity:0;letter-spacing:.3em;filter:blur(10px)}to{opacity:1;letter-spacing:-.02em;filter:blur(0)}}@keyframes float-note{0%{transform:translateY(0) rotate(0deg);opacity:0}15%{opacity:.7}85%{opacity:.2}100%{transform:translateY(-100vh) rotate(540deg);opacity:0}}`}</style>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════
  // ── MAIN APP ─────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════
  const currentSong=activeGuide?songLibrary[activeGuide]:activeSheet?songLibrary[activeSheet]:null

  const S = {
    card:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14},
    goldCard:{background:"rgba(245,158,11,0.07)",border:`1px solid ${Gb}`,borderRadius:14},
  }

  return (
    <div style={{height:"100vh",display:"grid",gridTemplateRows:"auto 1fr",gridTemplateColumns:"1fr 380px",gridTemplateAreas:`"header header" "piano sidebar"`,background:"radial-gradient(ellipse at 20% 0%,#1a0a30 0%,#06040f 55%,#0a180a 100%)",overflow:"hidden",gap:0}}>

      {/* ── HEADER ── */}
      <div style={{gridArea:"header",display:"flex",alignItems:"center",gap:12,padding:"10px 20px",background:"rgba(0,0,0,0.35)",borderBottom:"1px solid rgba(245,158,11,0.1)",backdropFilter:"blur(20px)",zIndex:10}}>
        <button onClick={()=>setPhase("landing")} style={{background:"none",border:"none",cursor:"pointer",padding:0}}>
          <span className="swaraa-gold" style={{fontSize:22,fontWeight:900}}>Swaraa</span>
        </button>
        <div style={{flex:1,position:"relative",maxWidth:520}}>
          <span style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",fontSize:15,pointerEvents:"none"}}>🔍</span>
          <input type="text" value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search any song — Naatu Naatu, Tum Hi Ho, Yaman Alaap..."
            style={{width:"100%",padding:"9px 14px 9px 40px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1.5px solid ${searchQ?G:"rgba(255,255,255,0.08)"}`,color:"#e8dfc8",fontSize:13,boxShadow:searchQ?`0 0 0 3px rgba(245,158,11,0.1)`:""}} />
          {searchQ&&<button onClick={()=>setSearchQ("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"rgba(232,223,200,0.4)",fontSize:14,cursor:"pointer"}}>✕</button>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {[{k:"search",l:"🔍",tip:"Search"},{k:"practice",l:"🎯",tip:"Practice"},{k:"your-songs",l:"🎵",tip:"Your Songs"},{...(profile?.role==="admin"?{k:"admin",l:"👑",tip:"Admin"}:{k:"",l:"",tip:""})},].filter(x=>x.k).map(x=>(
            <button key={x.k} onClick={()=>setActiveSection(x.k as any)} title={x.tip} style={{width:36,height:36,borderRadius:10,border:`1px solid ${activeSection===x.k?G:"rgba(255,255,255,0.08)"}`,background:activeSection===x.k?Gd:"rgba(255,255,255,0.04)",fontSize:15,cursor:"pointer",color:activeSection===x.k?G:"rgba(232,223,200,0.5)",transition:"all 0.2s"}}>{x.l}</button>
          ))}
          <button onClick={()=>setShowSettings(true)} title="Settings" style={{width:36,height:36,borderRadius:10,border:`1px solid ${showSettings?G:"rgba(255,255,255,0.08)"}`,background:showSettings?Gd:"rgba(255,255,255,0.04)",fontSize:15,cursor:"pointer",color:showSettings?G:"rgba(232,223,200,0.5)"}}>⚙️</button>
          <div style={{width:1,height:24,background:"rgba(255,255,255,0.1)"}}/>
          <div style={{fontSize:11,color:"rgba(232,223,200,0.4)",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{user.email?.split("@")[0]}</div>
          <button onClick={handleLogout} style={{padding:"6px 12px",borderRadius:9,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",fontSize:11,fontWeight:600,cursor:"pointer"}}>Sign out</button>
        </div>
      </div>

      {/* ── LEFT: PIANO + PRACTICE ────────────────────────────────── */}
      <div style={{gridArea:"piano",display:"flex",flexDirection:"column",overflow:"hidden",padding:"14px 14px 14px 20px",gap:12}}>

        {/* TOAST */}
        {toast&&<div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",zIndex:9999,padding:"9px 20px",borderRadius:12,background:toast.type==="error"?"rgba(239,68,68,0.95)":toast.type==="warn"?"rgba(245,158,11,0.95)":toast.type==="success"?"rgba(16,185,129,0.95)":"rgba(14,11,24,0.96)",color:toast.type==="error"||toast.type==="warn"||toast.type==="success"?"#fff":G,fontSize:13,fontWeight:600,border:`1px solid ${toast.type==="error"?"rgba(239,68,68,0.3)":toast.type==="warn"?"rgba(245,158,11,0.3)":toast.type==="success"?"rgba(16,185,129,0.3)":"rgba(245,158,11,0.3)"}`,backdropFilter:"blur(16px)",boxShadow:"0 8px 30px rgba(0,0,0,0.5)"}}>{toast.msg}</div>}

        {/* Celebration */}
        {showCelebration&&<div style={{position:"fixed",inset:0,zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
          <div style={{textAlign:"center",animation:"scale-pop 0.5s ease"}}>
            <div style={{fontSize:72,marginBottom:12}}>🎉</div>
            <div className="swaraa-gold" style={{fontSize:44,fontWeight:900}}>Song Complete!</div>
            <div style={{fontSize:18,color:"rgba(232,223,200,0.6)",marginTop:8}}>{Math.round((correctHits/(correctHits+wrongHits||1))*100)}% accuracy · {correctHits} correct</div>
          </div>
        </div>}

        {/* ── RECORD MODE ── */}
        {recordMode?(
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:12,overflow:"hidden"}}>
            {/* Recording header */}
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",...S.goldCard}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:isRecording?"#ef4444":"rgba(239,68,68,0.3)",animation:isRecording?"recording-ring 1s ease infinite":""}}/>
              <span style={{fontSize:14,fontWeight:700,color:G}}>{isRecording?"Recording...":recordedNotes.length>0?"Recording ready":"Ready to record"}</span>
              {recordedNotes.length>0&&<span style={{fontSize:11,color:"rgba(232,223,200,0.4)",marginLeft:"auto"}}>{recordedNotes.length} events · ~{Math.round((recordedNotes[recordedNotes.length-1]?.time||0)/1000)}s</span>}
            </div>
            {/* Piano in record mode */}
            <div style={{flex:1,background:"linear-gradient(180deg,#1a0e04,#0c0702)",borderRadius:18,border:"2px solid rgba(139,90,43,0.45)",overflow:"hidden",display:"flex",flexDirection:"column"}}>
              <div style={{display:"flex",justifyContent:"space-between",padding:"7px 18px",background:"linear-gradient(90deg,rgba(100,60,20,0.4),rgba(180,120,60,0.1),rgba(100,60,20,0.4))",borderBottom:"1px solid rgba(100,60,20,0.3)"}}>
                <span className="swaraa-gold" style={{fontSize:12,fontWeight:700,letterSpacing:"0.15em"}}>SWARAA</span>
                <span style={{fontSize:10,color:"rgba(180,130,70,0.4)"}}>Record your melody</span>
              </div>
              <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",overflowX:"auto",padding:"16px 20px",scrollbarWidth:"none"}}>
                <div style={{position:"relative",height:236}}>
                  <div style={{display:"flex",position:"absolute",bottom:0,gap:2}}>
                    {wKeys.map((k,wi)=>{const active=pressedKeys.has(k.midi);const blk2=selectedRaga!=="Free"&&!RAGAS[selectedRaga].notes.includes(k.nin);return(<div key={wi} onMouseDown={()=>!blk2&&noteOn(k.midi)} onMouseUp={()=>noteOff(k.midi)} onMouseLeave={()=>noteOff(k.midi)} onTouchStart={e=>{e.preventDefault();!blk2&&noteOn(k.midi)}} onTouchEnd={e=>{e.preventDefault();noteOff(k.midi)}} className={active?"correct-anim":""} style={{width:64,height:220,borderRadius:"0 0 12px 12px",cursor:"pointer",userSelect:"none",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",paddingBottom:12,background:active?"linear-gradient(180deg,#fef3c7,#fbbf24 70%,#f59e0b)":blk2?"linear-gradient(180deg,#9ca3af,#6b7280)":"linear-gradient(180deg,#fffef8,#f5f0e0 70%,#e8dfc8)",border:`1.5px solid ${active?G:blk2?"#4b5563":"#c8b898"}`,boxShadow:active?`0 0 22px rgba(245,158,11,0.65)`:"0 5px 12px rgba(0,0,0,0.45)",transform:active?"translateY(5px)":"none",transition:"all 0.07s",zIndex:1}}><div style={{fontSize:14,fontWeight:700,color:active?"#92400e":"#6b5030"}}>{k.label}</div>{k.kchar&&<div style={{fontSize:11,color:"rgba(100,70,20,0.6)",fontWeight:600}}>{k.kchar}</div>}</div>)})}
                  </div>
                  <div style={{position:"absolute",top:0,left:0,zIndex:2,pointerEvents:"none"}}>
                    {(()=>{const BL:Record<number,number>={54:42,56:108,59:240,61:306,63:372,66:504,68:570,70:636,73:768,75:834,78:966,80:1032,83:1164};return bKeys.map((k)=>{const active=pressedKeys.has(k.midi);const blk2=selectedRaga!=="Free"&&!RAGAS[selectedRaga].notes.includes(k.nin);const lp=BL[k.midi]??0;return(<div key={k.midi} onMouseDown={e=>{e.stopPropagation();!blk2&&noteOn(k.midi)}} onMouseUp={e=>{e.stopPropagation();noteOff(k.midi)}} onMouseLeave={()=>noteOff(k.midi)} onTouchStart={e=>{e.preventDefault();e.stopPropagation();!blk2&&noteOn(k.midi)}} onTouchEnd={e=>{e.preventDefault();noteOff(k.midi)}} style={{pointerEvents:"all",position:"absolute",left:lp,top:0,width:42,height:136,borderRadius:"0 0 8px 8px",cursor:"pointer",userSelect:"none",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",paddingBottom:6,background:active?"linear-gradient(180deg,#fbbf24,#d97706)":blk2?"linear-gradient(180deg,#374151,#1f2937)":"linear-gradient(180deg,#1c1008,#0a0604)",border:`1px solid ${active?G:blk2?"#374151":"rgba(0,0,0,.9)"}`,boxShadow:active?`0 0 20px rgba(245,158,11,.75)`:"0 6px 12px rgba(0,0,0,.9)",transform:active?"translateY(3px)":"none",transition:"all 0.07s"}}><div style={{fontSize:10,fontWeight:700,color:active?"#92400e":"rgba(200,150,80,.7)"}}>{k.label}</div></div>)})})()}
                  </div>
                </div>
              </div>
            </div>
            {/* Record controls */}
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {!isRecording?(
                <button onClick={()=>{setRecordedNotes([]);recStart.current=Date.now();setIsRecording(true)}} style={{padding:"11px 20px",borderRadius:12,background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",boxShadow:"0 4px 16px rgba(239,68,68,0.35)"}}>🔴 Start Recording</button>
              ):(
                <button onClick={()=>setIsRecording(false)} style={{padding:"11px 20px",borderRadius:12,background:"#374151",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer"}}>⏹ Stop</button>
              )}
              {recordedNotes.length>0&&!isRecording&&(
                <button onClick={()=>playingBack?stopPB():playRecordingBack(recordedNotes)} style={{padding:"11px 20px",borderRadius:12,background:playingBack?"#374151":"linear-gradient(135deg,#10b981,#059669)",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer"}}>
                  {playingBack?"⏹ Stop":"▶ Listen"}
                </button>
              )}
              {recordedNotes.length>0&&!isRecording&&(
                <input type="text" value={recordName} onChange={e=>setRecordName(e.target.value)} placeholder="Name your recording..." style={{flex:1,padding:"11px 14px",borderRadius:12,background:"rgba(255,255,255,0.06)",border:`1px solid ${Gb}`,color:"#e8dfc8",fontSize:13}}/>
              )}
              {recordedNotes.length>0&&!isRecording&&recordName&&(
                <button onClick={saveRecording} style={{padding:"11px 20px",borderRadius:12,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",whiteSpace:"nowrap"}}>💾 Save</button>
              )}
              <button onClick={()=>{setRecordMode(false);setRecordedNotes([]);setIsRecording(false);stopPB()}} style={{padding:"11px 16px",borderRadius:12,background:"rgba(239,68,68,0.1)",border:"1px solid rgba(239,68,68,0.2)",color:"#ef4444",fontSize:13,fontWeight:600,cursor:"pointer"}}>✕ Cancel</button>
            </div>
          </div>
        ):(
          <>
          {/* ── NORMAL: PIANO ── */}
          <div style={{background:"linear-gradient(180deg,#1a0e04,#0c0702)",borderRadius:18,border:"2px solid rgba(139,90,43,0.45)",overflow:"hidden",flexShrink:0,boxShadow:"0 20px 60px rgba(0,0,0,0.6),inset 0 1px 0 rgba(255,210,120,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",padding:"6px 18px",background:"linear-gradient(90deg,rgba(100,60,20,0.4),rgba(180,120,60,0.1),rgba(100,60,20,0.4))",borderBottom:"1px solid rgba(100,60,20,0.3)"}}>
              <span className="swaraa-gold" style={{fontSize:12,fontWeight:700,letterSpacing:"0.15em"}}>SWARAA</span>
              <div style={{display:"flex",gap:4}}>{[...Array(8)].map((_,i)=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:`hsl(${28+i*7},76%,${44+i*4}%)`}}/>)}</div>
              <span style={{fontSize:10,color:"rgba(180,130,70,0.4)"}}>where every note breathes</span>
            </div>
            <div style={{overflowX:"auto",padding:"16px 20px",scrollbarWidth:"none"}}>
              <div style={{display:"flex",justifyContent:"center",minWidth:"max-content"}}>
                <div style={{position:"relative",height:236}}>
                  <div style={{display:"flex",position:"absolute",bottom:0,gap:2}}>
                    {wKeys.map((k,wi)=>{const active=pressedKeys.has(k.midi);const blk2=selectedRaga!=="Free"&&!RAGAS[selectedRaga].notes.includes(k.nin);const guide=isGuideKey(k.midi);return(<div key={wi} onMouseDown={()=>!blk2&&noteOn(k.midi)} onMouseUp={()=>noteOff(k.midi)} onMouseLeave={()=>noteOff(k.midi)} onTouchStart={e=>{e.preventDefault();!blk2&&noteOn(k.midi)}} onTouchEnd={e=>{e.preventDefault();noteOff(k.midi)}} className={`${active?"correct-anim":""}${guide?" guide-key":""}`} style={{width:64,height:220,borderRadius:"0 0 12px 12px",cursor:"pointer",userSelect:"none",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",paddingBottom:12,background:active?"linear-gradient(180deg,#fef3c7,#fbbf24 70%,#f59e0b)":guide?"linear-gradient(180deg,#d1fae5,#6ee7b7 70%,#10b981)":blk2?"linear-gradient(180deg,#9ca3af,#6b7280)":"linear-gradient(180deg,#fffef8,#f5f0e0 70%,#e8dfc8)",border:`1.5px solid ${active?G:guide?"#10b981":blk2?"#4b5563":"#c8b898"}`,boxShadow:active?`0 0 22px rgba(245,158,11,.65)`:guide?"":"0 5px 12px rgba(0,0,0,.45)",transform:active?"translateY(5px)":guide?"translateY(-3px)":"none",transition:"all 0.07s",zIndex:1}}><div style={{fontSize:14,fontWeight:700,color:active?"#92400e":guide?"#065f46":blk2?"rgba(255,255,255,.4)":"#6b5030"}}>{k.label}</div>{k.kchar&&<div style={{fontSize:11,color:guide?"rgba(6,95,70,.8)":"rgba(100,70,20,.55)",fontWeight:600}}>{k.kchar}</div>}</div>)})}
                  </div>
                  <div style={{position:"absolute",top:0,left:0,zIndex:2,pointerEvents:"none"}}>
                    {(()=>{const BL:Record<number,number>={54:42,56:108,59:240,61:306,63:372,66:504,68:570,70:636,73:768,75:834,78:966,80:1032,83:1164};return bKeys.map((k)=>{const active=pressedKeys.has(k.midi);const blk2=selectedRaga!=="Free"&&!RAGAS[selectedRaga].notes.includes(k.nin);const guide=isGuideKey(k.midi);const lp=BL[k.midi]??0;return(<div key={k.midi} onMouseDown={e=>{e.stopPropagation();!blk2&&noteOn(k.midi)}} onMouseUp={e=>{e.stopPropagation();noteOff(k.midi)}} onMouseLeave={()=>noteOff(k.midi)} onTouchStart={e=>{e.preventDefault();e.stopPropagation();!blk2&&noteOn(k.midi)}} onTouchEnd={e=>{e.preventDefault();noteOff(k.midi)}} className={guide?"guide-key":""} style={{pointerEvents:"all",position:"absolute",left:lp,top:0,width:42,height:136,borderRadius:"0 0 8px 8px",cursor:"pointer",userSelect:"none",display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",paddingBottom:6,background:active?"linear-gradient(180deg,#fbbf24,#d97706)":guide?"linear-gradient(180deg,#6ee7b7,#10b981)":blk2?"linear-gradient(180deg,#374151,#1f2937)":"linear-gradient(180deg,#1c1008,#0a0604)",border:`1px solid ${active?G:guide?"#10b981":blk2?"#374151":"rgba(0,0,0,.9)"}`,boxShadow:active?`0 0 20px rgba(245,158,11,.75)`:guide?`0 0 25px rgba(16,185,129,.85)`:"0 6px 12px rgba(0,0,0,.9)",transform:active?"translateY(3px)":guide?"translateY(-3px)":"none",transition:"all 0.07s"}}><div style={{fontSize:10,fontWeight:700,color:active?"#92400e":guide?"#064e3b":"rgba(200,150,80,.7)"}}>{k.label}</div></div>)})})()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── CONTENT AREA ── */}
          <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:12,scrollbarWidth:"thin",paddingRight:4}}>

            {/* Guide banner when active */}
            {activeGuide&&songLibrary[activeGuide]&&guideStep<songLibrary[activeGuide].notes.length&&(
              <div style={{padding:"10px 16px",borderRadius:14,...S.goldCard,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:16}}>🎯</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:G}}>{activeGuide}</div>
                    <div style={{fontSize:11,color:"rgba(232,223,200,0.5)"}}>Step {guideStep+1}/{songLibrary[activeGuide].notes.length} · Play the <strong style={{color:"#10b981"}}>green key</strong></div>
                  </div>
                </div>
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <span style={{fontSize:12,fontWeight:700,color:"#10b981"}}>✅{correctHits}</span>
                  <span style={{fontSize:12,fontWeight:700,color:"#ef4444"}}>❌{wrongHits}</span>
                  <button onClick={toggleListen} style={{padding:"5px 10px",borderRadius:9,background:guideListenActive?"#374151":"rgba(99,102,241,0.2)",color:"#818cf8",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>
                    {guideListenActive?"⏹":"👂"} Listen
                  </button>
                  <button onClick={resetGuide} style={{padding:"5px 9px",borderRadius:9,background:Gd,color:G,border:"none",cursor:"pointer",fontSize:11}}>↺</button>
                  <button onClick={()=>setActiveSection("practice")} style={{padding:"5px 9px",borderRadius:9,background:"rgba(255,255,255,0.05)",color:"rgba(232,223,200,0.5)",border:"none",cursor:"pointer",fontSize:11}}>📄 Sheet</button>
                  <button onClick={closePractice} style={{padding:"5px 9px",borderRadius:9,background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:11}}>✕</button>
                </div>
              </div>
            )}

            {/* Note history */}
            {noteHistory.length>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:"rgba(232,223,200,0.3)",marginRight:2}}>Notes:</span>
                {noteHistory.map((n,i)=><span key={i} style={{fontSize:11,fontWeight:700,padding:"2px 7px",borderRadius:8,background:`hsla(${i*28+30},70%,55%,0.18)`,color:`hsl(${i*28+30},70%,68%)`}}>{n}</span>)}
                <span style={{fontSize:10,color:"rgba(232,223,200,0.25)",marginLeft:"auto"}}>{sessionNotes} notes · {selectedRaga}</span>
              </div>
            )}

            {/* ── SEARCH SECTION ── */}
            {activeSection==="search"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {searchQ&&(
                  <div style={{...S.card,overflow:"hidden"}}>
                    {searchResults.length>0?(
                      <>
                        <div style={{padding:"8px 14px",background:Gd,fontSize:11,fontWeight:600,color:G}}>🔎 {searchResults.length} result{searchResults.length!==1?"s":""}</div>
                        {searchResults.map(name=>{const s=songLibrary[name];return(
                          <div key={name} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,0.05)",flexWrap:"wrap",gap:8}}>
                            <div style={{display:"flex",alignItems:"center",gap:9}}>
                              <span style={{fontSize:22}}>{s.emoji}</span>
                              <div>
                                <div style={{fontSize:13,fontWeight:600,color:"#e8dfc8",display:"flex",alignItems:"center",gap:6}}>{name}{s.source==="ai"&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:"rgba(16,185,129,0.2)",color:"#10b981"}}>🤖</span>}</div>
                                <div style={{fontSize:10,color:"rgba(232,223,200,0.38)"}}>{s.genre} · {s.language} · {s.bpm}BPM · {s.notes.length} notes</div>
                              </div>
                              <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:`${diffColor(s.difficulty)}22`,color:diffColor(s.difficulty),fontWeight:600}}>{s.difficulty}</span>
                            </div>
                            <div style={{display:"flex",gap:5}}>
                              <button onClick={()=>openSheet(name)} style={{padding:"6px 12px",borderRadius:9,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.25)",cursor:"pointer",fontSize:11,fontWeight:600}}>📄 Sheet</button>
                              <button onClick={()=>openGuide(name)} style={{padding:"6px 12px",borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",border:"none",cursor:"pointer",fontSize:11,fontWeight:700}}>🎯 Practice</button>
                              <button onClick={()=>playSong(name)} style={{padding:"6px 12px",borderRadius:9,background:playingSongName===name?"#374151":"rgba(16,185,129,0.15)",color:playingSongName===name?"#9ca3af":"#10b981",border:"1px solid rgba(16,185,129,0.25)",cursor:"pointer",fontSize:11,fontWeight:600}}>{playingSongName===name?"⏹":"▶"}</button>
                            </div>
                          </div>
                        )})}
                      </>
                    ):(
                      <div style={{padding:"16px 16px"}}>
                        <div style={{fontSize:13,fontWeight:600,color:"#e8dfc8",marginBottom:6}}>🤔 "{searchQ}" not found</div>
                        <div style={{fontSize:11,color:"rgba(232,223,200,0.4)",marginBottom:12}}>
                          {aiUsage?`${aiUsage.used}/${aiUsage.limit} AI searches used today · ${aiUsage.remaining} remaining`:"AI-powered search — finds the real melody online"}
                        </div>
                        <button onClick={()=>handleAI(searchQ)} disabled={aiLoading} style={{padding:"10px 20px",borderRadius:12,background:aiLoading?"#374151":"linear-gradient(135deg,#10b981,#059669)",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:8}}>
                          {aiLoading?(<><span style={{width:14,height:14,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin 0.8s linear infinite",display:"inline-block"}}/><span>Searching online...</span></>):(<span>🤖 Search with AI</span>)}
                        </button>
                        {aiError&&<div style={{marginTop:10,padding:"8px 12px",borderRadius:10,background:"rgba(239,68,68,0.1)",color:"#ef4444",fontSize:12,border:"1px solid rgba(239,68,68,0.2)"}}>⚠️ {aiError}</div>}
                      </div>
                    )}
                  </div>
                )}
                {/* Genre filter + grid */}
                <div style={{display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",paddingBottom:2}}>
                  {allGenres.map(g=><button key={g} onClick={()=>setGenreFilter(g)} style={{padding:"5px 12px",borderRadius:20,fontSize:11,fontWeight:600,border:"none",cursor:"pointer",whiteSpace:"nowrap",background:genreFilter===g?G:"rgba(255,255,255,0.05)",color:genreFilter===g?"#0e0b18":"rgba(232,223,200,0.45)",transition:"all 0.15s"}}>{g}</button>)}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:8}}>
                  {filteredSongs.map(name=>{const s=songLibrary[name];const isA=activeSheet===name||activeGuide===name;return(
                    <div key={name} style={{padding:12,borderRadius:12,background:isA?Gd:"rgba(255,255,255,0.04)",border:`1px solid ${isA?G:"rgba(255,255,255,0.07)"}`,cursor:"pointer",transition:"all 0.15s"}} onClick={()=>openSheet(name)}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                        <span style={{fontSize:22}}>{s.emoji}</span>
                        <div style={{display:"flex",flexDirection:"column",gap:2,alignItems:"flex-end"}}>
                          <span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:`${diffColor(s.difficulty)}22`,color:diffColor(s.difficulty),fontWeight:600}}>{s.difficulty}</span>
                          {s.source==="ai"&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:8,background:"rgba(16,185,129,0.2)",color:"#10b981"}}>🤖</span>}
                        </div>
                      </div>
                      <div style={{fontSize:12,fontWeight:600,color:isA?G:"#e8dfc8",lineHeight:1.3,marginBottom:3}}>{name}</div>
                      <div style={{fontSize:10,color:"rgba(232,223,200,0.3)",marginBottom:8}}>{s.language} · {s.bpm}BPM · {s.notes.length} notes</div>
                      <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                        <button onClick={()=>openSheet(name)} style={{flex:1,padding:"4px",borderRadius:7,fontSize:10,fontWeight:600,background:"rgba(99,102,241,0.15)",color:"#818cf8",border:"none",cursor:"pointer"}}>📄</button>
                        <button onClick={()=>openGuide(name)} style={{flex:1,padding:"4px",borderRadius:7,fontSize:10,fontWeight:700,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",border:"none",cursor:"pointer"}}>🎯</button>
                        <button onClick={()=>playSong(name)} style={{flex:1,padding:"4px",borderRadius:7,fontSize:10,fontWeight:600,background:playingSongName===name?"#374151":"rgba(16,185,129,0.15)",color:playingSongName===name?"#9ca3af":"#10b981",border:"none",cursor:"pointer"}}>{playingSongName===name?"⏹":"▶"}</button>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            )}

            {/* ── PRACTICE SECTION ── */}
            {activeSection==="practice"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {!activeSheet&&!activeGuide&&<div style={{padding:24,textAlign:"center",...S.card}}>
                  <div style={{fontSize:32,marginBottom:8}}>🎯</div>
                  <div style={{fontSize:15,fontWeight:600,color:"#e8dfc8",marginBottom:6}}>Ready to practice</div>
                  <div style={{fontSize:12,color:"rgba(232,223,200,0.4)"}}>Search for a song and click 📄 Sheet or 🎯 Practice</div>
                </div>}

                {/* Note Sheet */}
                {activeSheet&&currentSong&&(
                  <div style={{...S.card,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"linear-gradient(135deg,rgba(245,158,11,0.12),rgba(180,90,0,0.08))",flexWrap:"wrap",gap:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:9}}>
                        <span style={{fontSize:22}}>{currentSong.emoji}</span>
                        <div>
                          <div style={{fontSize:14,fontWeight:700,color:G,fontFamily:"'Cinzel',serif"}}>{activeSheet}</div>
                          <div style={{fontSize:11,color:"rgba(232,223,200,0.4)"}}>{currentSong.genre} · {currentSong.language} · {currentSong.bpm}BPM · {currentSong.notes.length} notes</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>isPlayingSong?stopPB():playSong(activeSheet)} style={{padding:"6px 12px",borderRadius:9,background:isPlayingSong?"#374151":"linear-gradient(135deg,#10b981,#059669)",color:"#fff",border:"none",cursor:"pointer",fontSize:11,fontWeight:600}}>{isPlayingSong?"⏹ Stop":"▶ Listen"}</button>
                        <button onClick={()=>openGuide(activeSheet)} style={{padding:"6px 12px",borderRadius:9,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",border:"none",cursor:"pointer",fontSize:11,fontWeight:700}}>🎯 Practice</button>
                        <button onClick={closePractice} style={{padding:"6px 10px",borderRadius:9,background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"none",cursor:"pointer",fontSize:11}}>✕</button>
                      </div>
                    </div>
                    <div style={{padding:"12px 14px",overflowX:"auto",scrollbarWidth:"thin"}}>
                      <div style={{display:"flex",gap:7,minWidth:"max-content",paddingBottom:6}}>
                        {currentSong.notes.map((ev,i)=>{
                          const nin=((ev.note%12)+12)%12;const blk=isBlk(ev.note)
                          const kc=(M2K[ev.note]||M2K[ev.note-12]||M2K[ev.note+12]||"?").toUpperCase()
                          return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:3,flexShrink:0}}>
                            <div style={{fontSize:9,fontWeight:600,color:G,minWidth:30,textAlign:"center"}}>{ev.lyric||"—"}</div>
                            <div style={{minWidth:40,padding:"5px 7px",borderRadius:9,background:blk?"rgba(14,8,2,.95)":"rgba(255,248,225,.09)",border:`1.5px solid ${blk?"rgba(245,158,11,.35)":"rgba(180,140,60,.35)"}`,display:"flex",flexDirection:"column",alignItems:"center",gap:1}}>
                              <div style={{fontSize:11,fontWeight:700,color:G}}>{SARGAM[nin]}</div>
                              <div style={{fontSize:9,color:"rgba(232,223,200,.35)"}}>{WESTERN[nin]}</div>
                            </div>
                            <div style={{width:26,height:20,borderRadius:6,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,background:blk?"#1c1008":"#f5f0e0",border:`1px solid ${blk?"rgba(245,158,11,.45)":"rgba(180,140,80,.5)"}`,color:blk?G:"#5a3010",boxShadow:"0 2px 5px rgba(0,0,0,.4)"}}>{kc}</div>
                            <div style={{height:3,width:`${Math.min(40,ev.duration/20)}px`,borderRadius:2,background:G,opacity:.4,minWidth:5}}/>
                          </div>)
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Guided practice */}
                {activeGuide&&currentSong&&(()=>{
                  const step=guideStep;const song=currentSong
                  if(step>=song.notes.length) return (
                    <div style={{padding:32,textAlign:"center",...S.goldCard}}>
                      <div style={{fontSize:52,marginBottom:12}}>🎉</div>
                      <div className="swaraa-gold" style={{fontSize:30,fontWeight:900,marginBottom:8}}>Complete!</div>
                      <div style={{fontSize:13,color:"rgba(232,223,200,0.5)",marginBottom:16}}>✅{correctHits} · ❌{wrongHits} · {Math.round((correctHits/(correctHits+wrongHits||1))*100)}% accuracy</div>
                      <button onClick={resetGuide} style={{padding:"11px 28px",borderRadius:13,background:"linear-gradient(135deg,#f59e0b,#b45309)",color:"#0e0b18",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>↺ Try Again</button>
                    </div>
                  )
                  const ev=song.notes[step];const nin=((ev.note%12)+12)%12;const blk=isBlk(ev.note)
                  const kc=(M2K[ev.note]||M2K[ev.note-12]||M2K[ev.note+12]||"?").toUpperCase()
                  const nc=hitFeedback==="correct"?"linear-gradient(135deg,#10b981,#059669)":hitFeedback==="wrong"?"linear-gradient(135deg,#ef4444,#b91c1c)":blk?"linear-gradient(135deg,#1c1008,#0a0604)":"linear-gradient(135deg,#fffef5,#e8dfc8)"
                  const bc=hitFeedback==="correct"?"#10b981":hitFeedback==="wrong"?"#ef4444":G
                  return(
                    <div style={{borderRadius:16,overflow:"hidden",border:`2px solid ${bc}`,boxShadow:`0 0 30px ${hitFeedback==="correct"?"rgba(16,185,129,0.2)":hitFeedback==="wrong"?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.08)"}`,transition:"border-color 0.15s"}}>
                      <div style={{height:3,background:"rgba(255,255,255,0.05)"}}>
                        <div style={{height:"100%",background:"linear-gradient(90deg,#f59e0b,#10b981)",width:`${Math.round((step/song.notes.length)*100)}%`,transition:"width .3s"}}/>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:20,padding:"18px 20px",background:"rgba(14,11,24,0.8)",flexWrap:"wrap"}}>
                        <div style={{textAlign:"center"}}>
                          <div style={{fontSize:10,color:"rgba(232,223,200,0.3)",letterSpacing:"0.1em",marginBottom:10}}>PRESS NOW</div>
                          <div style={{position:"relative",display:"inline-block",marginBottom:18}}>
                            <div className={hitFeedback==="correct"?"correct-anim":hitFeedback==="wrong"?"wrong-anim":""} style={{width:100,height:100,borderRadius:16,background:nc,border:`3px solid ${bc}`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 25px ${hitFeedback==="correct"?"rgba(16,185,129,0.5)":hitFeedback==="wrong"?"rgba(239,68,68,0.5)":"rgba(245,158,11,0.3)"}`,transition:"all 0.15s"}}>
                              <div style={{fontSize:22,fontWeight:700,color:hitFeedback?"#fff":blk?G:"#5a3010"}}>{SARGAM[nin]}</div>
                              <div style={{fontSize:13,color:hitFeedback?"rgba(255,255,255,0.6)":blk?"rgba(245,158,11,0.5)":"rgba(90,48,16,0.6)"}}>{WESTERN[ev.note]}</div>
                            </div>
                            <div style={{position:"absolute",bottom:-14,left:"50%",transform:"translateX(-50%)",width:32,height:26,borderRadius:7,background:blk?"#1c1008":"#f5f0e0",border:`2px solid ${G}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:blk?G:"#5a3010"}}>{kc}</div>
                          </div>
                          {ev.lyric&&<div style={{fontSize:24,fontWeight:700,color:G,fontFamily:"'Cinzel',serif",fontStyle:"italic",marginTop:4}}>"{ev.lyric}"</div>}
                        </div>
                        <div>
                          <div style={{fontSize:10,color:"rgba(232,223,200,0.3)",marginBottom:8,letterSpacing:"0.08em"}}>UP NEXT</div>
                          <div style={{display:"flex",gap:5}}>
                            {song.notes.slice(step+1,step+5).map((n,i)=>{const nn=((n.note%12)+12)%12;const nb=isBlk(n.note);const nk=(M2K[n.note]||M2K[n.note-12]||"?").toUpperCase();return(<div key={i} style={{opacity:1-i*.17,minWidth:34,padding:"4px 6px",borderRadius:8,background:nb?"rgba(14,8,2,.9)":"rgba(255,248,225,.07)",border:`1px solid ${nb?"rgba(245,158,11,.2)":"rgba(180,140,80,.25)"}`,textAlign:"center"}}>
                              <div style={{fontSize:10,fontWeight:700,color:nb?G:"rgba(232,223,200,.65)"}}>{SARGAM[nn]}</div>
                              <div style={{fontSize:8,color:"rgba(232,223,200,.25)"}}>{nk}</div>
                            </div>)})}
                          </div>
                        </div>
                      </div>
                      {/* Full strip */}
                      <div style={{padding:"0 16px 12px",overflowX:"auto",scrollbarWidth:"thin",background:"rgba(14,11,24,0.8)"}}>
                        <div style={{display:"flex",gap:4,minWidth:"max-content"}}>
                          {song.notes.map((ev2,i)=>{const nin2=((ev2.note%12)+12)%12;const blk2=isBlk(ev2.note);const done=i<step;const cur=i===step;const kc2=(M2K[ev2.note]||M2K[ev2.note-12]||"?").toUpperCase();return(<div key={i} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:2,flexShrink:0,opacity:done?0.3:1}}>
                            <div style={{fontSize:7,height:9,color:done?"#10b981":cur?G:"transparent"}}>{done?"✓":cur?"▼":""}</div>
                            <div style={{width:28,height:30,borderRadius:7,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:cur?"linear-gradient(135deg,#f59e0b,#b45309)":done?"rgba(16,185,129,0.15)":blk2?"rgba(14,8,2,.9)":"rgba(255,248,225,.06)",border:`1.5px solid ${cur?G:done?"rgba(16,185,129,.4)":blk2?"rgba(245,158,11,.15)":"rgba(180,140,80,.2)"}`,transform:cur?"scale(1.18)":"scale(1)",boxShadow:cur?`0 0 12px rgba(245,158,11,.6)`:""}}
                            >
                              <div style={{fontSize:8,fontWeight:700,color:cur?"#fff":done?"#10b981":blk2?G:"rgba(232,223,200,.5)"}}>{SARGAM[nin2]}</div>
                              <div style={{fontSize:7,color:cur?"rgba(255,255,255,.6)":"rgba(232,223,200,.2)"}}>{kc2}</div>
                            </div>
                          </div>)})}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            {/* ── YOUR SONGS ── */}
            {activeSection==="your-songs"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <div style={{fontSize:15,fontWeight:700,color:G}}>🎵 Your Recordings</div>
                  <button onClick={()=>{setRecordMode(true);setRecordedNotes([]);setIsRecording(false)}} style={{padding:"8px 16px",borderRadius:11,background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",border:"none",cursor:"pointer",fontSize:12,fontWeight:700}}>🔴 New Recording</button>
                </div>
                {loadingRecordings&&<div style={{padding:24,textAlign:"center",color:"rgba(232,223,200,0.4)",fontSize:13}}>Loading...</div>}
                {!loadingRecordings&&savedRecordings.length===0&&(
                  <div style={{padding:28,textAlign:"center",...S.card}}>
                    <div style={{fontSize:32,marginBottom:8}}>🎙️</div>
                    <div style={{fontSize:14,fontWeight:600,color:"#e8dfc8",marginBottom:6}}>No recordings yet</div>
                    <div style={{fontSize:12,color:"rgba(232,223,200,0.4)",marginBottom:16}}>Click "New Recording" to record your first melody!</div>
                    <button onClick={()=>{setRecordMode(true);setRecordedNotes([]);setIsRecording(false)}} style={{padding:"10px 20px",borderRadius:11,background:"linear-gradient(135deg,#ef4444,#b91c1c)",color:"#fff",border:"none",cursor:"pointer",fontSize:13,fontWeight:700}}>🔴 Start Recording</button>
                  </div>
                )}
                {savedRecordings.map(rec=>(
                  <div key={rec.id} style={{padding:"14px 16px",borderRadius:13,...S.card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,#ef4444,#b91c1c)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🎙️</div>
                      <div>
                        <div style={{fontSize:13,fontWeight:600,color:"#e8dfc8"}}>{rec.name}</div>
                        <div style={{fontSize:11,color:"rgba(232,223,200,0.38)"}}>{Math.round(rec.duration_ms/1000)}s · {rec.notes.length} events · {rec.created_at?new Date(rec.created_at).toLocaleDateString():""}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>playingBack?stopPB():playRecordingBack(rec.notes)} style={{padding:"7px 12px",borderRadius:9,background:playingBack?"#374151":"rgba(16,185,129,0.15)",color:playingBack?"#9ca3af":"#10b981",border:"1px solid rgba(16,185,129,0.25)",cursor:"pointer",fontSize:11,fontWeight:600}}>{playingBack?"⏹":"▶"} Play</button>
                      <button onClick={()=>rec.id&&deleteRecording(rec.id)} style={{padding:"7px 11px",borderRadius:9,background:"rgba(239,68,68,0.1)",color:"#ef4444",border:"1px solid rgba(239,68,68,0.2)",cursor:"pointer",fontSize:11}}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ADMIN ── */}
            {activeSection==="admin"&&profile?.role==="admin"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{fontSize:15,fontWeight:700,color:G}}>👑 Admin Panel</div>
                {adminLoading&&<div style={{padding:20,textAlign:"center",color:"rgba(232,223,200,0.4)"}}>Loading users...</div>}
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:4}}>
                  {[{l:"Total Users",v:adminUsers.length},{l:"Admins",v:adminUsers.filter(u=>u.role==="admin").length},{l:"Users",v:adminUsers.filter(u=>u.role==="user").length}].map(s=>(
                    <div key={s.l} style={{padding:"12px 14px",borderRadius:12,...S.goldCard,textAlign:"center"}}>
                      <div style={{fontSize:22,fontWeight:700,color:G}}>{s.v}</div>
                      <div style={{fontSize:11,color:"rgba(232,223,200,0.45)"}}>{s.l}</div>
                    </div>
                  ))}
                </div>
                {adminUsers.map(u=>(
                  <div key={u.id} style={{padding:"12px 14px",borderRadius:12,...S.card,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:600,color:"#e8dfc8"}}>{u.email}</div>
                      <div style={{fontSize:11,color:"rgba(232,223,200,0.38)"}}>{new Date(u.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{display:"flex",gap:6,alignItems:"center"}}>
                      <span style={{fontSize:10,padding:"3px 8px",borderRadius:20,background:u.role==="admin"?"rgba(245,158,11,0.2)":"rgba(99,102,241,0.2)",color:u.role==="admin"?G:"#818cf8",fontWeight:600}}>{u.role}</span>
                      {u.id!==user?.id&&(
                        <button onClick={()=>setUserRole(u.id,u.role==="admin"?"user":"admin")} style={{padding:"4px 10px",borderRadius:8,background:"rgba(255,255,255,0.06)",color:"rgba(232,223,200,0.6)",border:"1px solid rgba(255,255,255,0.1)",cursor:"pointer",fontSize:11}}>Toggle</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* ── RIGHT SIDEBAR ─────────────────────────────────────────── */}
      <div style={{gridArea:"sidebar",overflowY:"auto",padding:"14px 20px 14px 0",display:"flex",flexDirection:"column",gap:10,scrollbarWidth:"thin"}}>

        {/* Record button */}
        <button onClick={()=>{setRecordMode(true);setRecordedNotes([]);setIsRecording(false)}} style={{width:"100%",padding:"12px",borderRadius:13,background:"linear-gradient(135deg,rgba(239,68,68,0.15),rgba(185,28,28,0.1))",border:"1px solid rgba(239,68,68,0.3)",color:"#ef4444",fontSize:13,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.2s"}}
          onMouseEnter={e=>(e.currentTarget.style.background="linear-gradient(135deg,rgba(239,68,68,0.25),rgba(185,28,28,0.15))")}
          onMouseLeave={e=>(e.currentTarget.style.background="linear-gradient(135deg,rgba(239,68,68,0.15),rgba(185,28,28,0.1))")}>
          <div style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px rgba(239,68,68,0.6)"}}/>
          Record Your Melody
        </button>

        {/* Raga Selector */}
        <div style={{padding:"14px",...S.goldCard}}>
          <div style={{fontSize:11,fontWeight:700,color:G,letterSpacing:"0.08em",marginBottom:10}}>🌸 RAGA</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
            {Object.entries(RAGAS).map(([name,r])=>(
              <button key={name} onClick={()=>{setSelectedRaga(name);showToast(`${name} — ${r.mood}`)}} style={{padding:"8px 10px",borderRadius:10,border:`1px solid ${selectedRaga===name?r.color:"rgba(255,255,255,0.07)"}`,background:selectedRaga===name?`${r.color}20`:"rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left",transition:"all 0.15s",boxShadow:selectedRaga===name?`0 0 12px ${r.color}33`:""}}>
                <div style={{fontSize:11,fontWeight:700,color:selectedRaga===name?r.color:"rgba(232,223,200,0.7)"}}>{name}</div>
                <div style={{fontSize:9,color:"rgba(232,223,200,0.35)",marginTop:1}}>{r.mood}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Drone */}
        <div style={{padding:"14px",...S.card}}>
          <div style={{fontSize:11,fontWeight:700,color:"rgba(232,223,200,0.6)",letterSpacing:"0.08em",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
            🎵 DRONE
            {droneNote!==null&&<span style={{fontSize:9,padding:"2px 6px",borderRadius:8,background:G,color:"#0e0b18",fontWeight:700}}>LIVE</span>}
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {[{l:"Sa",n:60},{l:"Pa",n:67},{l:"Ma",n:65},{l:"Re",n:62},{l:"Dha",n:69},{l:"Ni",n:71}].map(d=>(
              <button key={d.l} onClick={()=>startDrone(d.n)} style={{padding:"7px 12px",borderRadius:9,fontSize:12,fontWeight:600,background:droneNote===d.n?"linear-gradient(135deg,#f59e0b,#b45309)":Gd,color:droneNote===d.n?"#0e0b18":G,border:`1px solid ${droneNote===d.n?G:"rgba(245,158,11,0.2)"}`,cursor:"pointer",transition:"all 0.15s"}}>{d.l}</button>
            ))}
            {droneNote!==null&&<button onClick={()=>{if(droneRef.current){try{droneRef.current.stop()}catch{}};setDroneNote(null)}} style={{padding:"7px 11px",borderRadius:9,fontSize:12,background:"rgba(239,68,68,0.15)",color:"#ef4444",border:"none",cursor:"pointer"}}>🔇</button>}
          </div>
        </div>

        {/* Quick stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          {[{l:"Key",v:getRootNote(),c:"#6366f1"},{l:"Octave",v:currentOctave,c:"#ec4899"},{l:"Notes",v:sessionNotes,c:G},{l:"Raga",v:selectedRaga,c:RAGAS[selectedRaga]?.color||G}].map(s=>(
            <div key={s.l} style={{padding:"10px 12px",borderRadius:11,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.07)",textAlign:"center"}}>
              <div style={{fontSize:18,fontWeight:700,color:s.c,fontFamily:"'Inter',sans-serif"}}>{String(s.v)}</div>
              <div style={{fontSize:9,color:"rgba(232,223,200,0.35)",marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Settings panel (inside sidebar) */}
        {showSettings&&(
          <div style={{padding:"16px",...S.goldCard,animation:"slide-in-up 0.3s ease"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <span style={{fontSize:13,fontWeight:700,color:G}}>⚙️ Settings</span>
              <button onClick={()=>setShowSettings(false)} style={{background:"none",border:"none",color:"rgba(232,223,200,0.4)",cursor:"pointer",fontSize:16}}>✕</button>
            </div>
            {/* Volume */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(232,223,200,0.5)",marginBottom:5}}><span>🔊 Volume</span><span style={{color:G,fontWeight:600}}>{volume}%</span></div>
              <input type="range" min={0} max={100} step={1} value={volume} onChange={e=>setVolume(+e.target.value)} style={{width:"100%",accentColor:G}}/>
            </div>
            {/* Transpose */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(232,223,200,0.5)",marginBottom:5}}><span>🎵 Transpose</span><span style={{color:G,fontWeight:600}}>{getRootNote()} ({transpose>0?"+":""}{transpose})</span></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setTranspose(t=>Math.max(-11,t-1))} style={{flex:1,padding:"6px",borderRadius:8,background:Gd,color:G,border:"none",cursor:"pointer",fontWeight:700}}>-</button>
                <button onClick={()=>setTranspose(t=>Math.min(11,t+1))} style={{flex:1,padding:"6px",borderRadius:8,background:Gd,color:G,border:"none",cursor:"pointer",fontWeight:700}}>+</button>
              </div>
            </div>
            {/* Octave */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(232,223,200,0.5)",marginBottom:5}}><span>🎚️ Octave</span><span style={{color:"#ec4899",fontWeight:600}}>{currentOctave}</span></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setCurrentOctave(o=>Math.max(0,o-1))} style={{flex:1,padding:"6px",borderRadius:8,background:"rgba(236,72,153,0.12)",color:"#ec4899",border:"none",cursor:"pointer",fontWeight:700}}>-</button>
                <button onClick={()=>setCurrentOctave(o=>Math.min(6,o+1))} style={{flex:1,padding:"6px",borderRadius:8,background:"rgba(236,72,153,0.12)",color:"#ec4899",border:"none",cursor:"pointer",fontWeight:700}}>+</button>
              </div>
            </div>
            {/* Reeds */}
            <div style={{marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(232,223,200,0.5)",marginBottom:5}}><span>🪗 Extra Reeds</span><span style={{color:"#ef4444",fontWeight:600}}>{additionalReeds}</span></div>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setAdditionalReeds(r=>Math.max(0,r-1))} style={{flex:1,padding:"6px",borderRadius:8,background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"none",cursor:"pointer",fontWeight:700}}>-</button>
                <button onClick={()=>setAdditionalReeds(r=>Math.min(6-currentOctave,r+1))} style={{flex:1,padding:"6px",borderRadius:8,background:"rgba(239,68,68,0.12)",color:"#ef4444",border:"none",cursor:"pointer",fontWeight:700}}>+</button>
              </div>
            </div>
            {/* Reverb */}
            <div style={{marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <span style={{fontSize:11,color:"rgba(232,223,200,0.5)"}}>🏛️ Reverb</span>
              <button onClick={()=>setUseReverb(!useReverb)} style={{width:44,height:24,borderRadius:20,position:"relative",background:useReverb?"#10b981":"rgba(128,128,128,0.25)",border:"none",cursor:"pointer"}}>
                <div style={{width:18,height:18,background:"#fff",borderRadius:"50%",position:"absolute",top:3,left:useReverb?23:3,transition:"left 0.2s",boxShadow:"0 1px 4px rgba(0,0,0,0.3)"}}/>
              </button>
            </div>
            {/* EQ */}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:11,color:"rgba(232,223,200,0.5)",marginBottom:6}}>🎛️ EQ</div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#14b8a6",marginBottom:3}}><span>Bass</span><span>{bassEQ>0?"+":""}{bassEQ}dB</span></div>
              <input type="range" min={-12} max={12} step={1} value={bassEQ} onChange={e=>setBassEQ(+e.target.value)} style={{width:"100%",accentColor:"#14b8a6",marginBottom:8}}/>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:"#14b8a6",marginBottom:3}}><span>Treble</span><span>{trebleEQ>0?"+":""}{trebleEQ}dB</span></div>
              <input type="range" min={-12} max={12} step={1} value={trebleEQ} onChange={e=>setTrebleEQ(+e.target.value)} style={{width:"100%",accentColor:"#14b8a6"}}/>
            </div>
            {/* AI Usage */}
            {aiUsage&&<div style={{fontSize:10,padding:"8px 10px",borderRadius:9,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)",color:"#10b981"}}>
              🤖 AI Search: {aiUsage.used}/{aiUsage.limit} today · {aiUsage.remaining} remaining
            </div>}
            {!aiUsage&&<div style={{fontSize:10,color:"rgba(232,223,200,0.35)"}}>🤖 AI search: 10 searches/day included</div>}
            {/* MIDI */}
            {midiSupported&&<div style={{fontSize:10,color:"rgba(232,223,200,0.35)",marginTop:10}}>🎹 MIDI: {midiDevices.length} device{midiDevices.length!==1?"s":""} connected</div>}
          </div>
        )}
      </div>

      <style>{`@keyframes scale-pop{0%{transform:scale(0.8);opacity:0}60%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}@keyframes slide-in-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}@keyframes recording-ring{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 8px rgba(239,68,68,0)}}`}</style>
    </div>
  )
}
