import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

interface BalkanMotoRoad {
  id: string
  name: string
  description: string
  lat: number
  lng: number
  difficulty: 'easy' | 'moderate' | 'challenging' | 'extreme'
  roadType: 'asphalt' | 'mixed' | 'gravel'
  lengthKm: number
  country: string
  rating: number
}

// Curated motorcycle roads across the Balkans - Butler Maps equivalent
const BALKAN_ROADS: BalkanMotoRoad[] = [
  // === SLOVENIA ===
  { id: 'slo-1', name: 'Prelaz Vršič', description: '50 klancev, najzahtevnejši prelaz v Sloveniji. 50 ozkih ovinkov z velikim naklonom.', lat: 46.4333, lng: 13.7333, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 18, country: 'SI', rating: 5 },
  { id: 'slo-2', name: 'Prelaz Mangart', description: 'Najvišji cestni prelaz v Sloveniji (2072m). Osamljenost in razgledi na Julijske Alpe.', lat: 46.4500, lng: 13.6333, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 12, country: 'SI', rating: 5 },
  { id: 'slo-3', name: 'Prelaz Predel', description: 'Strme serpentine na italijanski meji. Klasična motoristična pot.', lat: 46.3833, lng: 13.5667, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 15, country: 'SI', rating: 4 },
  { id: 'slo-4', name: 'Jezersko - Preval', description: 'Zavite gorske ceste z odličnimi razgledi na Kamniške Alpe.', lat: 46.4000, lng: 14.8500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 22, country: 'SI', rating: 4 },
  { id: 'slo-5', name: 'Gorjanci', description: 'Krasne vijugaste ceste skozi gorjanske gozdove na meji s Hrvaško.', lat: 45.8000, lng: 15.1667, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'SI', rating: 4 },
  { id: 'slo-6', name: 'Col - Predmeja', description: 'Vijugaste ceste Notranjske, idealne za sproščeno vožnjo.', lat: 45.7500, lng: 14.2500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 18, country: 'SI', rating: 3 },
  { id: 'slo-7', name: 'Cerkno - Škofja Loka', description: 'Slikovite vijugaste ceste skozi Cerkno hribovje.', lat: 46.1167, lng: 14.0500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'SI', rating: 4 },
  { id: 'slo-8', name: 'Pohorje', description: 'Gozdne klance in razgledne ceste po Pohorju.', lat: 46.5000, lng: 15.5500, difficulty: 'moderate', roadType: 'mixed', lengthKm: 25, country: 'SI', rating: 3 },
  { id: 'slo-9', name: 'Soška dolina', description: 'Znamenita dolina reke Soče z vijugastimi cestami in razgledi na reko turkizno Sočo.', lat: 46.2500, lng: 13.6500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'SI', rating: 5 },

  // === CROATIA ===
  { id: 'hrv-1', name: 'Jadranska magistrala', description: 'Legendarna obalna cesta ob Jadranu z razgledi na otoke in modro morje.', lat: 43.5000, lng: 16.4500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 200, country: 'HR', rating: 5 },
  { id: 'hrv-2', name: 'Prelaz Mali Alan', description: 'Zavita gorska cesta skozi Velebit z razgledi na otoke.', lat: 44.4000, lng: 15.5000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'HR', rating: 5 },
  { id: 'hrv-3', name: 'Paklenica - Velebit', description: 'Gorska cesta skozi narodni park Paklenica z velikim višinskim zamahom.', lat: 44.3500, lng: 15.4500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'HR', rating: 4 },
  { id: 'hrv-4', name: 'Pelješac', description: 'Otoška cesta po polotoku Pelješac z vinogradi in razgledi na Korčulo.', lat: 42.9500, lng: 17.4500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'HR', rating: 4 },
  { id: 'hrv-5', name: 'Delnice - Gorski Kotar', description: 'Gozdne ceste Gorskega Kotarja, zelo priljubljene pri motoristih.', lat: 45.4000, lng: 14.8000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'HR', rating: 4 },

  // === BOSNIA & HERZEGOVINA ===
  { id: 'bih-1', name: 'Prelaz Ivan Sedlo', description: 'Gorski prelaz med Sarajevom in Konjicem z veličastnimi razgledi.', lat: 43.7000, lng: 18.0500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'BA', rating: 4 },
  { id: 'bih-2', name: 'Jablanica - Prozor', description: 'Vijugasta dolinska cesta ob Neretvi z razgledi na reko.', lat: 43.6500, lng: 17.3000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 45, country: 'BA', rating: 3 },
  { id: 'bih-3', name: 'Neum Obala', description: 'Obalna cesta ob edinem bosanskem morju.', lat: 42.9200, lng: 17.6100, difficulty: 'easy', roadType: 'asphalt', lengthKm: 15, country: 'BA', rating: 3 },

  // === MONTENEGRO ===
  { id: 'mne-1', name: 'Kotor Serpentine', description: 'Ena najbolj znanih motorističnih cest na svetu! 25 serpentin čez goro s pogledom na Boko Kotorsko.', lat: 42.4200, lng: 18.7700, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 16, country: 'ME', rating: 5 },
  { id: 'mne-2', name: 'Prelaz Lovćen', description: 'Gorski prelaz v narodnem parku Lovćen z razgledom na Kotorski zaliv.', lat: 42.3800, lng: 18.8500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'ME', rating: 5 },
  { id: 'mne-3', name: 'Durmitor - Žabljak', description: 'Visokogorska cesta v narodnem parku Durmitor z razgledi na ledeniška jezera.', lat: 43.1500, lng: 19.1200, difficulty: 'challenging', roadType: 'mixed', lengthKm: 35, country: 'ME', rating: 4 },
  { id: 'mne-4', name: 'Obala Budve', description: 'Obalna cesta od Budve do Svetega Stefana z mediteranskim vzdušjem.', lat: 42.2800, lng: 18.8400, difficulty: 'easy', roadType: 'asphalt', lengthKm: 20, country: 'ME', rating: 4 },

  // === SERBIA ===
  { id: 'srb-1', name: 'Prelaz Višegrad', description: 'Gorska cesta proti meji z Bosno z razgledi na reko Drino.', lat: 43.7800, lng: 19.2900, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'RS', rating: 3 },
  { id: 'srb-2', name: 'Zlatibor - Mokra Gora', description: 'Priljubljena motoristična pot skozi zahodno Srbijo s slikovitimi vasmi.', lat: 43.7200, lng: 19.7000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 45, country: 'RS', rating: 4 },
  { id: 'srb-3', name: 'Đerdap Klisura', description: 'Cesta ob Donavi skozi Đerdap klisuro - ena najlepših rečnih dolin v Evropi.', lat: 44.6100, lng: 22.3400, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'RS', rating: 4 },

  // === NORTH MACEDONIA ===
  { id: 'mkd-1', name: 'Ohridsko jezero', description: 'Obalna cesta ob Ohridskem jezeru z razgledi na vodno gladino in gore.', lat: 41.1200, lng: 20.8000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 40, country: 'MK', rating: 4 },
  { id: 'mkd-2', name: 'Prelaz Gjavica', description: 'Visokogorski prelaz med Ohridom in Bitolo s serpentinami.', lat: 41.2000, lng: 20.6500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'MK', rating: 4 },

  // === ALBANIA ===
  { id: 'alb-1', name: 'Llogara Pass', description: 'Vzpon iz Vlore na 1027m z osupljivimi razgledi na Jonsko morje in otoke.', lat: 40.1800, lng: 19.5800, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 22, country: 'AL', rating: 5 },
  { id: 'alb-2', name: 'Obala Albanije (Riviera)', description: 'Podoben amalfijski obali - vijugasta cesta ob čistem Jonskem morju.', lat: 40.0500, lng: 19.7500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 80, country: 'AL', rating: 5 },
  { id: 'alb-3', name: 'Prelaz Theth', description: 'Osupljiva gorska cesta v severnoalbanskih Alpah. Nedotaknjena narava.', lat: 42.3800, lng: 19.7700, difficulty: 'extreme', roadType: 'gravel', lengthKm: 30, country: 'AL', rating: 5 },
  { id: 'alb-4', name: 'Valbona - Bajram Curri', description: 'Gorska dolina v albanskih Alpah z osupljivimi razgledi.', lat: 42.4500, lng: 19.9500, difficulty: 'challenging', roadType: 'mixed', lengthKm: 25, country: 'AL', rating: 4 },

  // === GREECE ===
  { id: 'grc-1', name: 'Prelaz Katara', description: 'Znameniti prelaz med Epirom in Tesalijo, legendaren med motoristi.', lat: 39.7700, lng: 21.2300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 30, country: 'GR', rating: 5 },
  { id: 'grc-2', name: 'Peloponeška obala', description: 'Vijugaste obalne ceste Peloponeza z mediteranskim vzdušjem.', lat: 37.6000, lng: 22.8000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 80, country: 'GR', rating: 4 },

  // === BULGARIA ===
  { id: 'bgr-1', name: 'Prelaz Shipka', description: 'Zgodovinski prelaz čez Stara Planino z osupljivimi razgledi in spomenikom.', lat: 42.7100, lng: 25.3300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'BG', rating: 4 },
  { id: 'bgr-2', name: 'Transbalkanska cesta', description: 'Čez gorski hrbet Stara Planina, zelo priljubljena pri motoristih.', lat: 42.7500, lng: 25.1000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 50, country: 'BG', rating: 4 },

  // === ROMANIA ===
  { id: 'rou-1', name: 'Transfăgărășan', description: 'Ena najbolj znanih cest na svetu! 90 km ovinkov čez Fagaraške gore do 2034m. DN7C.', lat: 45.5900, lng: 24.6200, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 90, country: 'RO', rating: 5 },
  { id: 'rou-2', name: 'Transalpina (DN67C)', description: 'Najvišja cesta v Romuniji (2145m) z osupljivimi gorskimi razgledi. Bolj divja od Transfăgărășan.', lat: 45.4300, lng: 23.7200, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 80, country: 'RO', rating: 5 },
  { id: 'rou-3', name: 'Transbucegi', description: 'Gorska cesta v Bucegi gorah z razgledi na dolino Prahove.', lat: 45.4000, lng: 25.4300, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'RO', rating: 4 },

  // === HUNGARY ===
  { id: 'hun-1', name: 'Visegrádi-hegység', description: 'Vijugaste ceste po gričevju nad Donavo z razgledi na reko.', lat: 47.7800, lng: 18.9700, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 25, country: 'HU', rating: 3 },
  { id: 'hun-2', name: 'Balatonska obala', description: 'Obalna cesta ob Blatnem jezeru z vinogradi in mediteranskim vzdušjem.', lat: 46.9000, lng: 17.9000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 60, country: 'HU', rating: 3 },

  // === AUSTRIA ===
  { id: 'aut-1', name: 'Grossglockner Hochalpenstraße', description: 'Ena najbolj znanih gorskih cest v Evropi. 48 km s 36 ovinki do 2504m.', lat: 47.0800, lng: 12.8300, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 48, country: 'AT', rating: 5 },
  { id: 'aut-2', name: 'Nockalmstraße', description: 'Vijugasta alpska cesta v Koroški z razgledi na Nockberge.', lat: 46.9000, lng: 13.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 34, country: 'AT', rating: 4 },
  { id: 'aut-3', name: 'Villacher Alpenstraße', description: 'Alpska cesta nad Villachom z razgledi na Julijske Alpe in Karavanke.', lat: 46.6000, lng: 13.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 16, country: 'AT', rating: 4 },

  // === NEW ROADS (10 additional) ===
  // Slovenia - Ljubelj Pass
  { id: 'slo-10', name: 'Prelaz Ljubelj', description: 'Zgodovinski prelaz na avstrijski meji z ozkim predorom in strmimi klanci. Najstarejši cestni prelaz v Sloveniji.', lat: 46.4320, lng: 14.2640, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 14, country: 'SI', rating: 4 },
  // Slovenia - Črni vrh
  { id: 'slo-11', name: 'Črni vrh', description: 'Vijugasta cesta nad Idrijo z razgledi na Idrijsko hribovje in cerkvico na vrhu.', lat: 46.0500, lng: 13.9800, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 20, country: 'SI', rating: 4 },
  // Croatia - D8 Coastal Road
  { id: 'hrv-6', name: 'D8 Obalna cesta (Senj-Zadar)', description: 'Legendarna obalna cesta D8 med Senjom in Zadrom. Razgledi na Velebit in morje.', lat: 44.1500, lng: 15.2000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 110, country: 'HR', rating: 5 },
  // Croatia - Učka Pass
  { id: 'hrv-7', name: 'Prelaz Učka', description: 'Gorski prelaz čez Učko gorovje z osupljivimi razgledi na Kvarner in otoke.', lat: 45.3100, lng: 14.2200, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 18, country: 'HR', rating: 4 },
  // Montenegro - Piva Canyon Road
  { id: 'mne-5', name: 'Pivska klisura', description: 'Vijugasta cesta skozi veličastno Pivsko klisuro ob modrem Pivskem jezeru. Ena najlepših cest v Črni gori.', lat: 43.0500, lng: 18.9500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 45, country: 'ME', rating: 5 },
  // Albania - SH21 Theth-Valbona
  { id: 'alb-5', name: 'SH21 Theth-Valbona', description: 'Novo zgrajena gorska cesta med Theth in Valbono v albanskih Alpah. Osamljenost in razgledi.', lat: 42.4000, lng: 19.8300, difficulty: 'extreme', roadType: 'mixed', lengthKm: 28, country: 'AL', rating: 5 },
  // Romania - Bucegi Mountains Road
  { id: 'rou-4', name: 'Bucegi gorska cesta', description: 'Gorska cesta v Bucegi gorah z razgledom na Babele in Sfinx skalne formacije.', lat: 45.3800, lng: 25.4700, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 30, country: 'RO', rating: 4 },
  // Bulgaria - Rhodope Mountains Road
  { id: 'bgr-3', name: 'Rodopska gorska cesta', description: 'Čudovita cesta skozi Rodope z gostimi gozdovi, razgledi in tradicionalnimi vasmi.', lat: 41.6500, lng: 24.6500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 55, country: 'BG', rating: 4 },
  // Greece - Meteora Road
  { id: 'grc-3', name: 'Meteora cesta', description: 'Cesta do samostanov Meteora - monumentalne skale s samostani na vrhu. Enkraten prizor.', lat: 39.7200, lng: 21.6300, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 15, country: 'GR', rating: 5 },
  // Serbia - Tara National Park Road
  { id: 'srb-4', name: 'Tara - Narodni park', description: 'Gozdna cesta skozi narodni park Tara z razgledi na Drinsko klisuro.', lat: 43.9500, lng: 19.5500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'RS', rating: 4 },
  // Bosnia - Jajce-Travnik Mountain Road
  { id: 'bih-4', name: 'Jajce - Travnik gorska cesta', description: 'Vijugasta gorska cesta med Jajce in Travnikom skozi osrednjobosansko hribovje.', lat: 44.0500, lng: 17.5500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'BA', rating: 4 },

  // =============================================
  // === SLOVENIA - NOVE CESTE (15 dodatnih) ===
  // =============================================
  { id: 'slo-12', name: 'Prelaz Preval (Paka)', description: 'Mirna gorska cesta skozi gozdove nad Pako, idealna za sproščeno vožnjo.', lat: 46.4100, lng: 14.7300, difficulty: 'easy', roadType: 'asphalt', lengthKm: 18, country: 'SI', rating: 3 },
  { id: 'slo-13', name: 'Pivška planota', description: 'Kraška planota s širokimi razgledi, mirnimi cestami in kraškimi polji. Skriti biser.', lat: 45.6500, lng: 14.3500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 35, country: 'SI', rating: 4 },
  { id: 'slo-14', name: 'Solkanski klanc (Nova Gorica)', description: 'Strmi klanc iz Nove Gorice proti Solkanu s pogledom na Sočo in Sabotin.', lat: 45.9600, lng: 13.6400, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 8, country: 'SI', rating: 3 },
  { id: 'slo-15', name: 'Škofja Loka - Železniki', description: 'Slikovita cesta skozi Selško dolino s starimi fužinarskimi vasmi.', lat: 46.2200, lng: 14.1500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 22, country: 'SI', rating: 4 },
  { id: 'slo-16', name: 'Idrija - Vojsko', description: 'Strma gozdna cesta nad Idrijo z razgledi na Idrijsko hribovje in cerkev Sv. Ahacija.', lat: 46.0200, lng: 13.9700, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 15, country: 'SI', rating: 4 },
  { id: 'slo-17', name: 'Robanškovo (Solčava)', description: 'Alpska cesta pod Olševo z razgledi na Savinjsko dolino. Redko obiskana, čudovita.', lat: 46.4400, lng: 14.6700, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 12, country: 'SI', rating: 5 },
  { id: 'slo-18', name: 'Logarška dolina', description: 'Ena najlepših alpskih dolin v Evropi. Konec doline s slapom Rinka.', lat: 46.4700, lng: 14.6200, difficulty: 'easy', roadType: 'asphalt', lengthKm: 10, country: 'SI', rating: 5 },
  { id: 'slo-19', name: 'Slovenske Konjice - Švab (Švabski klanc)', description: 'Znan klanc iz Slovenskih Konjic na Žičko kartuzijo. Priljubljen pri lokalnih motoristih.', lat: 46.3400, lng: 15.4300, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 8, country: 'SI', rating: 4 },
  { id: 'slo-20', name: 'Bohinjska kotlina', description: 'Cesta ob Bohinjskem jezeru in naprej v Ribčev Laz s pogledom na Savinjske Alpe.', lat: 46.2800, lng: 13.8700, difficulty: 'easy', roadType: 'asphalt', lengthKm: 15, country: 'SI', rating: 4 },
  { id: 'slo-21', name: 'Prelaz Črni vrh (Idrija)', description: 'Strmi klanci nad Idrijo, ki so bili nekoč del rudarskih poti. Slavni pri motoristih.', lat: 46.0300, lng: 14.0200, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 16, country: 'SI', rating: 4 },
  { id: 'slo-22', name: 'Kojca - Cerkno', description: 'Gozdna cesta med Cerknim in hribom Kojca z osupljivimi razgledi na Idrijsko hribovje.', lat: 46.1500, lng: 14.0000, difficulty: 'moderate', roadType: 'mixed', lengthKm: 18, country: 'SI', rating: 4 },
  { id: 'slo-23', name: 'Vipavska dolina', description: 'Vijugasta cesta skozi Vipavsko dolino s pridihom mediteranskega vzdušja in vinogradi.', lat: 45.9200, lng: 13.9200, difficulty: 'easy', roadType: 'asphalt', lengthKm: 25, country: 'SI', rating: 4 },
  { id: 'slo-24', name: 'Banjšice', description: 'Kraška planota nad Soško dolino s širokimi razgledi na Julijske Alpe in Sočo.', lat: 46.0400, lng: 13.6200, difficulty: 'moderate', roadType: 'mixed', lengthKm: 30, country: 'SI', rating: 4 },
  { id: 'slo-25', name: 'Triglavska cesta (Dovje-Mojstrana)', description: 'Kratka a slikovita cesta pod Triglavom s pogledom na severne stene.', lat: 46.4400, lng: 13.9200, difficulty: 'easy', roadType: 'asphalt', lengthKm: 10, country: 'SI', rating: 4 },
  { id: 'slo-26', name: 'Kras (Sežana - Komen)', description: 'Kraške ceste s suhozidi, vinogradi in razgledi na Tržaški zaliv. Mediteranski pridih.', lat: 45.7000, lng: 13.8500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 22, country: 'SI', rating: 3 },

  // =============================================
  // === CROATIA - NOVE CESTE (12 dodatnih) ===
  // =============================================
  { id: 'hrv-8', name: 'Prelaz Oštrik (Gorski Kotar)', description: 'Ovit klanec v globoki gozdu Gorskega Kotarja. Redko obiskan, kot nalašč za motoriste.', lat: 45.3800, lng: 14.6500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 12, country: 'HR', rating: 4 },
  { id: 'hrv-9', name: 'D1 Drniš - Knin', description: 'Hitra vijugasta cesta skozi Dalmatinsko zagoro, odlična za športno vožnjo.', lat: 43.8500, lng: 16.2500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'HR', rating: 4 },
  { id: 'hrv-10', name: 'Krk - most in otoška cesta', description: 'Cesta na otok Krk čez 1430m dolg most in vijugaste otoške ceste.', lat: 45.2000, lng: 14.6000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 45, country: 'HR', rating: 3 },
  { id: 'hrv-11', name: 'Rab - otoška cesta', description: 'Majhen a čudovit otok s srednjeveškim mestom in mirnimi cestami ob obali.', lat: 44.7500, lng: 14.7800, difficulty: 'easy', roadType: 'asphalt', lengthKm: 20, country: 'HR', rating: 3 },
  { id: 'hrv-12', name: 'Pag - lunarna pokrajina', description: 'Cesta čez otok Pag s skalnato lunarno pokrajino in razgledi na modro morje.', lat: 44.4500, lng: 15.0500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 35, country: 'HR', rating: 4 },
  { id: 'hrv-13', name: 'D60 Makarska - Vrgorac', description: 'Strma cesta od obale v Zagoro z veličastnimi razgledi na Biokovo.', lat: 43.3000, lng: 17.1000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'HR', rating: 4 },
  { id: 'hrv-14', name: 'Biokovo cesta', description: 'Planinska cesta na Biokovo z najlepšim razgledom na Jadransko morje z 1600m.', lat: 43.2500, lng: 17.0500, difficulty: 'extreme', roadType: 'asphalt', lengthKm: 22, country: 'HR', rating: 5 },
  { id: 'hrv-15', name: 'Istra notranjost (Buzet - Motovun)', description: 'Vijugaste ceste skozi notranjost Istre s srednjeveškimi mesti na hribih in vinogradi.', lat: 45.3500, lng: 13.9000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'HR', rating: 4 },
  { id: 'hrv-16', name: 'Dobra - Ogulin', description: 'Gozdna cesta ob reki Dobri v Ogulinskem zatonu. Mirna in slikovita.', lat: 45.2800, lng: 15.2500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 20, country: 'HR', rating: 3 },
  { id: 'hrv-17', name: 'Pelješki most + cesta', description: 'Novi 2404m dolg most čez Malostonski zaliv in cesta po polotoku Pelješac.', lat: 42.9800, lng: 17.5500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 30, country: 'HR', rating: 4 },
  { id: 'hrv-18', name: 'Plitvička jezera pristop', description: 'Gozdna cesta do narodnega parka Plitvička jezera s pridihom divjine.', lat: 44.8700, lng: 15.5800, difficulty: 'easy', roadType: 'asphalt', lengthKm: 15, country: 'HR', rating: 3 },
  { id: 'hrv-19', name: 'Cetinska krajina', description: 'Vijugasta cesta ob reki Cetini z razgledi na gorsko reko in kanjon.', lat: 43.4500, lng: 16.7000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'HR', rating: 4 },

  // =============================================
  // === BALKAN - NOVE CESTE (23 dodatnih) ===
  // =============================================
  // Bosnia & Herzegovina
  { id: 'bih-5', name: 'Prelaz Tjentište', description: 'Gorska cesta skozi Sutjeska narodni park z razgledi na Zelena goro.', lat: 43.3500, lng: 18.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 28, country: 'BA', rating: 4 },
  { id: 'bih-6', name: 'Mostar - Blagaj', description: 'Kratka slikovita cesta do tekijo ob izviru reke Bune pod steno.', lat: 43.2600, lng: 17.8900, difficulty: 'easy', roadType: 'asphalt', lengthKm: 12, country: 'BA', rating: 4 },
  { id: 'bih-7', name: 'Krajina (Livno - Tomislavgrad)', description: 'Široke kraške ravnice in vijugaste ceste z razgledi na Dinarsko gorovje.', lat: 43.8500, lng: 17.2000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'BA', rating: 3 },

  // Montenegro
  { id: 'mne-6', name: 'Morača klisura', description: 'Vijugasta cesta skozi Moračko klisuro ob turkizni reki Morači. Ena najlepših v ČG.', lat: 42.7600, lng: 19.4000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 30, country: 'ME', rating: 5 },
  { id: 'mne-7', name: 'Skadarsko jezero obala', description: 'Obalna cesta ob Skadrskem jezeru z razgledi na vodno gladino in albanske gore.', lat: 42.2500, lng: 19.1500, difficulty: 'easy', roadType: 'asphalt', lengthKm: 25, country: 'ME', rating: 4 },
  { id: 'mne-8', name: 'Nikšić - Žabljak', description: 'Gorska cesta od Nikšića do Žabljaka s pogledi na Durmitor in visoke planote.', lat: 42.9500, lng: 19.0500, difficulty: 'challenging', roadType: 'mixed', lengthKm: 50, country: 'ME', rating: 4 },
  { id: 'mne-9', name: 'Tara most in klisura', description: 'Cesta do najvišjega mostu v Evropi (150m) čez Tarsko klisuro. Osupljivo.', lat: 43.1400, lng: 19.3700, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 18, country: 'ME', rating: 5 },

  // Serbia
  { id: 'srb-5', name: 'Fruška Gora', description: 'Vijugaste ceste skozi narodni park Fruška Gora nad Novim Sadom. Vinogradi in samostani.', lat: 45.1700, lng: 19.6800, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'RS', rating: 4 },
  { id: 'srb-6', name: 'Kopaonik - Brzeće', description: 'Gorska cesta na Kopaonik s pogledi na južno Srbijo in Kosovo.', lat: 43.3000, lng: 20.8000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 22, country: 'RS', rating: 4 },
  { id: 'srb-7', name: 'Uvac klisura', description: 'Cesta do slavne Uvaške klisure z meandri reke in beloglavi jastrebani.', lat: 43.5000, lng: 19.9500, difficulty: 'moderate', roadType: 'mixed', lengthKm: 25, country: 'RS', rating: 5 },

  // North Macedonia
  { id: 'mkd-3', name: 'Mavrovo - Debar', description: 'Gorska cesta skozi narodni park Mavrovo ob jezeru z razgledi na zasnežene vrhove.', lat: 41.6000, lng: 20.7500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 35, country: 'MK', rating: 4 },
  { id: 'mkd-4', name: 'Prelaz Bukovo (Prilep - Bitola)', description: 'Visokogorski prelaz med Prilepom in Bitolo s serpentinami in razgledi na Pelister.', lat: 41.2500, lng: 21.4000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'MK', rating: 4 },
  { id: 'mkd-5', name: 'Krusevo - vijugasta gorska cesta', description: 'Cesta do najvišjega mesta na Balkanu (1350m) s pogledi na Pelagonijo.', lat: 41.3700, lng: 21.2500, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 15, country: 'MK', rating: 4 },

  // Albania
  { id: 'alb-6', name: 'SH75 Korçe - Ersekë', description: 'Osamljena gorska cesta v jugovzhodni Albaniji z osupljivimi razgledi na gorovje.', lat: 40.6000, lng: 20.7000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 40, country: 'AL', rating: 4 },
  { id: 'alb-7', name: 'Gjirokastër - Përmet', description: 'Vijugasta cesta skozi južnoalbansko gorovje s pogledi na reke in osmanska mesta.', lat: 40.2500, lng: 20.2000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 45, country: 'AL', rating: 4 },
  { id: 'alb-8', name: 'Obala Sarande - Ksamil', description: 'Krajša obalna cesta ob Jonskem morju s pogledi na Krf in turkizno vodo.', lat: 39.7700, lng: 20.0000, difficulty: 'easy', roadType: 'asphalt', lengthKm: 15, country: 'AL', rating: 4 },

  // Greece
  { id: 'grc-4', name: 'Vikos klisura (Zagori)', description: 'Cesta do ene najglobljih sotesk na svetu v regiji Zagori. Kameni mostovi in divjina.', lat: 39.9000, lng: 20.7800, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 25, country: 'GR', rating: 5 },
  { id: 'grc-5', name: 'Olimp - Litochoro', description: 'Gorska cestra ob vznožju Olimpa z razgledi na najvišjo goro Grčije.', lat: 40.1100, lng: 22.4900, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 18, country: 'GR', rating: 4 },
  { id: 'grc-6', name: 'Mani - Peloponeška obala', description: 'Divja obalna cesta na polotoku Mani s srednjeveškimi stolpi in praznimi plažami.', lat: 37.0500, lng: 22.3500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 50, country: 'GR', rating: 5 },

  // Bulgaria
  { id: 'bgr-4', name: 'Prelaz Trojanski (Beklemeto)', description: 'Prelaz čez Stara Planino na cesti Trojan - Karnare. 1525m, vijugast in slikovit.', lat: 42.8000, lng: 24.6000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 35, country: 'BG', rating: 5 },
  { id: 'bgr-5', name: 'Ihtimanska Sredna Gora', description: 'Vijugaste ceste skozi Sredno Goro med Ihtimano in Koprivštico.', lat: 42.5500, lng: 24.0500, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 30, country: 'BG', rating: 4 },
  { id: 'bgr-6', name: 'Rila - samostan in gore', description: 'Cesta do slavnega Rilskega samostana z razgledi na gorsko verigo Rile.', lat: 42.1300, lng: 23.3400, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 25, country: 'BG', rating: 4 },

  // Romania
  { id: 'rou-5', name: 'Prelaz Bicaz (Cheile Bicazului)', description: 'Soteska reke Bicaz z navpičnimi stenami. Ena najbolj dramatičnih cest v Romuniji.', lat: 46.8300, lng: 25.8000, difficulty: 'challenging', roadType: 'asphalt', lengthKm: 20, country: 'RO', rating: 5 },
  { id: 'rou-6', name: 'Maramureș - vijugaste doline', description: 'Ceste skozi regijo Maramureș s tradicionalnimi lesenimi cerkvami in hribi.', lat: 47.7000, lng: 23.8000, difficulty: 'moderate', roadType: 'asphalt', lengthKm: 40, country: 'RO', rating: 4 },
  { id: 'rou-7', name: 'Transursoaia (DN75)', description: 'Osamljena gorska cesta v gorovju Apuseni s kraškimi jamami in gozdovi.', lat: 46.5000, lng: 22.7000, difficulty: 'challenging', roadType: 'mixed', lengthKm: 35, country: 'RO', rating: 4 },
]

const countryNames: Record<string, string> = {
  SI: 'Slovenija', HR: 'Hrvaška', BA: 'Bosna in Hercegovina', ME: 'Črna gora',
  RS: 'Srbija', MK: 'Severna Makedonija', AL: 'Albanija', GR: 'Grčija',
  BG: 'Bolgarija', RO: 'Romunija', HU: 'Madžarska', AT: 'Avstrija',
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const country = searchParams.get('country')
    const difficulty = searchParams.get('difficulty')

    let roads = [...BALKAN_ROADS]

    if (country) {
      roads = roads.filter(r => r.country === country.toUpperCase())
    }
    if (difficulty) {
      roads = roads.filter(r => r.difficulty === difficulty)
    }

    // Add country name to each road
    const result = roads.map(r => ({
      ...r,
      countryName: countryNames[r.country] || r.country,
    }))

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Balkan roads error:', error)
    return NextResponse.json({ error: 'Napaka' }, { status: 500 })
  }
}
