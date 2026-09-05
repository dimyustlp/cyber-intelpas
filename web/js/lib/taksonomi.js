/**
 * Taksonomi isu pemasyarakatan untuk Trans-Siber PAS.
 *
 * Sumber: rumusan Direktorat Pengamanan dan Intelijen, Ditjen Pemasyarakatan.
 * Berkas ini satu-satunya tempat taksonomi didefinisikan. Mesin klasifikasi,
 * tapis dasbor, dan penyusun laporan membacanya dari sini, supaya tidak pernah
 * ada dua daftar kategori yang perlahan berbeda isinya.
 *
 * Versi ini disusun ulang setelah menelaah 651 berita nyata di basis data.
 * Tiga hal yang berubah:
 *
 *   Kamus kehumasan diperbesar besar-besaran. Sebagian besar publikasi yang
 *   masuk setiap hari adalah unggahan resmi UPT — fun walk, donor darah, cek
 *   kesehatan gratis, MagangHub, PORSENI, lomba tujuh belasan. Mesin lama tidak
 *   mengenali satu pun di antaranya, sehingga ratusan berita positif menumpuk
 *   di keranjang "Lainnya" dan laporan mingguan kehilangan sisi baiknya.
 *
 *   Kategori 3 mendapat subkategori baru untuk dugaan korupsi dan
 *   penyalahgunaan wewenang. Sebelumnya perkara sebesar penyitaan aset pejabat
 *   kementerian tidak punya tempat sama sekali.
 *
 *   Kategori 9 ditambahkan untuk berita yang memang di luar lingkup. Rutan KPK
 *   dan Rutan Bareskrim bukan unit Pemasyarakatan; unggahan berbahasa Hindi
 *   yang kebetulan memuat kata "bapas" bukan berita sama sekali. Dulu keduanya
 *   menumpuk di "Lainnya" dan mengotori setiap angka yang dihitung dari sana.
 *
 * Bobot kata kunci:
 *   3 = penentu — kemunculannya hampir pasti menetapkan subkategori
 *   2 = kuat
 *   1 = pendukung — baru bermakna bila bergabung dengan yang lain
 *
 * Bentuk kata kunci:
 *   'frasa'              cocok bila urutan katanya utuh, kekerabatan per kata
 *   ['kata-a', 'kata-b'] cocok bila keduanya muncul di mana pun dalam teks
 *
 * Bobot boleh negatif. Bobot negatif dipakai untuk frasa yang justru
 * membatalkan subkategorinya — "bebas pungli" pada spanduk antikorupsi bukan
 * laporan pungli, dan tanpa bobot negatif kata "pungli" di dalamnya cukup untuk
 * memenangkan kategori yang salah.
 *
 * Modul ES murni tanpa impor, supaya bisa dipakai di peramban maupun di dalam
 * Edge Function Deno.
 */

export const KATEGORI = [
  {
    kode: '1',
    nama: 'Gangguan Keamanan dan Ketertiban',
    ringkas: 'Kamtib',
    sifat: 'negatif',
    warna: 'kritis',
    keterangan:
      'Insiden fisik atau operasional yang mengancam stabilitas dan keamanan di dalam Lapas atau Rutan.',
    subkategori: [
      {
        kode: '1.1',
        nama: 'Pelarian WBP',
        aktor: 'wbp',
        urgensi: 'Tinggi',
        kunci: [
          [['kabur', 'napi'], 3], [['kabur', 'narapidana'], 3], [['kabur', 'tahanan'], 3],
          [['kabur', 'lapas'], 2], [['kabur', 'rutan'], 2], [['kabur', 'warga binaan'], 3],
          [['melarikan diri', 'narapidana'], 3], [['melarikan diri', 'napi'], 3],
          [['melarikan diri', 'tahanan'], 3], [['melarikan diri', 'lapas'], 2],
          ['napi kabur', 3], ['tahanan kabur', 3], ['narapidana kabur', 3],
          ['warga binaan kabur', 3], ['kabur dari lapas', 3], ['kabur dari rutan', 3],
          ['kabur saat asimilasi', 3], ['melarikan diri', 3], ['pelarian', 3],
          ['lari dari lapas', 3], ['lari dari rutan', 3], ['pelarian wbp', 3],
          ['gergaji teralis', 3], ['jebol tembok', 3], ['bobol tembok', 3],
          ['panjat tembok', 3], ['lubang di dinding', 2], ['jebol plafon', 3],
          ['buron', 2], ['buronan', 2], ['percobaan pelarian', 3], ['upaya pelarian', 3],
          ['pencarian napi', 3], ['perburuan napi', 3], ['diburu petugas', 2],
          ['belum ditemukan', 1], ['hilang dari blok', 2], ['tidak kembali', 1],
          ['tak kembali ke lapas', 3], ['mangkir dari asimilasi', 3],
          ['berujung buron', 3], ['sempat kabur', 3], ['kembali ditangkap', 1],
          ['escape', 2], ['kabur duluan', 0],
        ],
        pola: [
          [/\b(\d{1,3})\s+(napi|narapidana|tahanan|warga binaan)[^.]{0,25}\bkabur\b/, 3],
          [/\bkabur\b[^.]{0,40}\b(lapas|rutan|lpka)\b/, 2],
        ],
      },
      {
        kode: '1.2',
        nama: 'Kerusuhan dan Pemberontakan',
        aktor: 'wbp',
        urgensi: 'Tinggi',
        kunci: [
          ['kerusuhan', 3], ['rusuh', 2], ['pemberontakan', 3], ['memberontak', 3],
          ['membakar lapas', 3], ['membakar rutan', 3], ['pembakaran fasilitas', 3],
          ['penyanderaan', 3], ['sandera petugas', 3], ['menyandera', 3],
          ['demonstrasi warga binaan', 3], ['ricuh', 2], ['kericuhan', 3],
          ['mengamuk', 2], ['amuk massa', 3], ['perlawanan massal', 3],
          ['blokade blok', 3], ['bentrokan', 2], ['huru hara', 3],
          ['merusak fasilitas', 3], ['pengrusakan', 2], ['aksi protes napi', 3],
          ['menolak masuk sel', 3], ['keributan', 2],
        ],
      },
      {
        kode: '1.3',
        nama: 'Kekerasan Antar WBP',
        aktor: 'wbp',
        urgensi: 'Sedang',
        kunci: [
          [['penganiayaan', 'napi'], 3], [['penganiayaan', 'warga binaan'], 3],
          [['dianiaya', 'sesama'], 3], [['perkelahian', 'napi'], 3],
          ['perkelahian', 2], ['berkelahi', 2], ['pengeroyokan', 3], ['dikeroyok', 3],
          ['bentrok antar', 3], ['tawuran', 3], ['penusukan', 3], ['ditusuk', 2],
          ['bacok', 3], ['dibacok', 3], ['napi bunuh napi', 3],
          ['penganiayaan sesama warga binaan', 3], ['bentrok napi', 3],
          ['perang antar geng', 3], ['dipukuli sesama', 3], ['adu jotos', 3],
          ['perselisihan antar warga binaan', 3], ['senjata tajam', 2], ['sajam', 2],
        ],
      },
    ],
  },

  {
    kode: '2',
    nama: 'Peredaran Barang Terlarang',
    ringkas: 'HALINAR',
    sifat: 'negatif',
    warna: 'kritis',
    keterangan:
      'Handphone, pungli, dan narkoba yang diinisiasi atau dikendalikan oleh warga binaan dari dalam fasilitas.',
    subkategori: [
      {
        kode: '2.1',
        nama: 'Pengendalian Narkoba oleh WBP',
        aktor: 'wbp',
        urgensi: 'Sedang',
        kunci: [
          [['narkoba', 'dikendalikan'], 3], [['narkotika', 'dikendalikan'], 3],
          [['sabu', 'sel'], 3], [['narkoba', 'jeruji'], 3], [['narkoba', 'napi'], 2],
          [['sabu', 'napi'], 3], [['narkoba', 'lapas'], 1], [['sabu', 'lapas'], 2],
          [['sabu', 'rutan'], 2], [['narkoba', 'rutan'], 1], [['narkoba', 'bandar'], 2],
          [['ganja', 'lapas'], 2], [['pil', 'lapas'], 1],
          ['dikendalikan dari dalam lapas', 3], ['dikendalikan dari balik jeruji', 3],
          ['pengendali narkoba', 3], ['pengendali peredaran narkoba', 3],
          ['bandar narkoba dari dalam', 3], ['jaringan narkoba lapas', 3],
          ['jaringan lapas', 3], ['jaringan napi', 3], ['sabu di sel', 3],
          ['ganja di sel', 3], ['peredaran narkoba', 2], ['kurir narkoba', 2],
          ['bisnis narkoba', 3], ['transaksi narkoba', 3], ['sarang narkoba', 3],
          ['pengedar narkoba', 2], ['jeruji besi', 1], ['tembakau sintetis', 3],
          ['narkoba', 1], ['narkotika', 1], ['sabu', 1], ['ekstasi', 2], ['ganja', 1],
        ],
        pola: [
          [/\b(bisnis|transaksi|peredaran|pengendali|sarang)\s+narkoba\b[^.]{0,40}\b(lapas|rutan)\b/, 3],
          [/\b(lapas|rutan)\b[^.]{0,40}\b(bisnis|transaksi|peredaran|sarang)\s+narkoba\b/, 3],
        ],
      },
      {
        kode: '2.2',
        nama: 'Kejahatan Siber dan HP Ilegal',
        aktor: 'wbp',
        urgensi: 'Sedang',
        kunci: [
          [['penipuan', 'lapas'], 3], [['penipuan', 'rutan'], 3],
          [['penipuan', 'jeruji'], 3], [['penipuan', 'napi'], 3],
          [['handphone', 'lapas'], 2], [['handphone', 'kamar'], 3],
          [['hp', 'kamar'], 2], [['hp', 'blok hunian'], 2],
          ['handphone ilegal', 3], ['hp ilegal', 3], ['ponsel ilegal', 3],
          ['napi main hp', 3], ['hp di dalam sel', 3], ['pakai hp', 2],
          ['love scamming', 3], ['penipuan online', 3], ['penipuan daring', 3],
          ['sindikat penipuan', 3], ['passobis', 3], ['pasobis', 3],
          ['penipuan berkedok', 3], ['pemerasan online', 3], ['judi online', 3],
          ['ditemukan handphone', 3], ['telepon genggam', 2], ['gawai', 2],
          ['modus penipuan', 3], ['penipuan dari balik jeruji', 3],
          ['bebas menggunakan handphone', 3], ['bebas pakai hp', 3],
          [['sindikat', 'lapas'], 3], [['sindikat', 'rutan'], 3],
          [['penipuan', 'balik jeruji'], 3], [['nipu', 'lapas'], 3],
          ['sindikat dari lapas', 3], ['sindikat dari rutan', 3],
          ['jual beli emas online', 3], ['penipuan jual beli online', 3],
          ['berpura pura jadi', 3], ['modus berkedok', 3], ['skema penipuan', 3],
          ['kejahatan siber', 3], ['dikendalikan lewat ponsel', 3],
        ],
        pola: [
          [/\b(napi|narapidana|warga binaan|tahanan)\b[^.]{0,40}\b(handphone|hp|ponsel)\b/, 2],
          [/\bpengawasan lemah\b/, 2],
          [/\bsindikat\b[^.]{0,40}\b(lapas|rutan)\b/, 3],
          [/\b(lapas|rutan)\b[^.]{0,30}\bsindikat\b/, 3],
        ],
      },
      {
        kode: '2.3',
        nama: 'Fasilitas Mewah dan Diskriminasi Kamar',
        aktor: 'campuran',
        urgensi: 'Sedang',
        kunci: [
          ['sel mewah', 3], ['kamar mewah', 3], ['fasilitas mewah', 3],
          ['sel vvip', 3], ['kamar vip', 3], ['ruangan ber ac', 3], ['ac di sel', 3],
          ['televisi di sel', 3], ['kasur mewah', 3], ['fasilitas tidak wajar', 3],
          ['kamar istimewa', 3], ['jual beli kamar', 3], ['perlakuan istimewa', 3],
          ['napi kelas atas', 3], ['sel khusus berbayar', 3],
        ],
      },
    ],
  },

  {
    kode: '3',
    nama: 'Pelanggaran Integritas Petugas',
    ringkas: 'Integritas',
    sifat: 'negatif',
    warna: 'kritis',
    keterangan:
      'Penyalahgunaan wewenang oleh oknum pegawai Pemasyarakatan. Wajib dipisahkan dari pelanggaran warga binaan.',
    subkategori: [
      {
        kode: '3.1',
        nama: 'Pungli dan Pemerasan oleh Petugas',
        aktor: 'petugas',
        urgensi: 'Sedang',
        kunci: [
          [['pungli', 'petugas'], 3], [['pungli', 'lapas'], 3], [['pungli', 'rutan'], 3],
          [['dimintai', 'kamar'], 3], [['bayar', 'pindah kamar'], 3],
          [['uang', 'kunjungan'], 2], [['pemerasan', 'rutan'], 3],
          [['pemerasan', 'lapas'], 3], [['pemerasan', 'petugas'], 3],
          ['pungli', 3], ['pungutan liar', 3], ['dimintai uang', 3],
          ['uang kamar', 3], ['uang layanan kunjungan', 3], ['setoran', 2],
          ['memeras keluarga', 3], ['pemerasan oleh oknum', 3], ['tarif kunjungan', 3],
          ['upeti', 3], ['uang pelicin', 3], ['gratifikasi', 3], ['uang rokok', 3],
          ['pungli merajalela', 3], ['kasus pemerasan', 3], ['diperas petugas', 3],
          // Bobot negatif membatalkan, bukan sekadar mengurangi. "Kanwil
          // Ditjenpas Jawa Tengah BEBAS PUNGLI!" adalah kampanye antikorupsi
          // milik unit itu sendiri, dan pernah tercatat sebagai kasus pungli
          // hanya karena kata "pungli" muncul di dalamnya.
          ['bebas pungli', -7], ['anti pungli', -7], ['tolak pungli', -7],
          ['saber pungli', -5], ['berintegritas', -4], ['komitmen kami', -3],
          ['tidak dipungut biaya', -5], ['gratis dan transparan', -4],
        ],
        pola: [[/\bpungli\b/, 2]],
      },
      {
        kode: '3.2',
        nama: 'Keterlibatan Petugas dalam Sindikat Narkoba',
        aktor: 'petugas',
        urgensi: 'Tinggi',
        kunci: [
          [['sipir', 'sabu'], 3], [['sipir', 'narkoba'], 3], [['sipir', 'ditangkap'], 3],
          [['oknum', 'sabu'], 3], [['oknum', 'narkoba'], 3], [['petugas', 'kurir'], 3],
          [['pegawai', 'narkoba'], 3], [['petugas', 'menyelundupkan'], 3],
          [['sipir', 'bnn'], 3], [['petugas lapas', 'ditangkap'], 3],
          [['oknum petugas', 'narkoba'], 3], [['kalapas', 'narkoba'], 3],
          ['oknum sipir bawa sabu', 3], ['sipir jadi kurir', 3],
          ['petugas jadi kurir', 3], ['oknum petugas narkoba', 3],
          ['sipir ditangkap bnn', 3], ['petugas menyelundupkan', 3],
          ['oknum membantu menyelundupkan', 3], ['petugas terlibat jaringan', 3],
          ['sipir terlibat narkoba', 3], ['pegawai lapas ditangkap narkoba', 3],
          ['keterlibatan petugas', 3], ['petugas terlibat', 3], ['pembiaran', 2],
          ['diduga dipelihara', 3],
        ],
      },
      {
        kode: '3.3',
        nama: 'Kekerasan oleh Petugas',
        aktor: 'petugas',
        urgensi: 'Tinggi',
        kunci: [
          [['penembakan', 'oknum'], 3], [['penembakan', 'petugas lapas'], 3],
          [['ditembak', 'sipir'], 3], [['penganiayaan', 'petugas'], 3],
          [['dianiaya', 'sipir'], 3], [['dianiaya', 'petugas'], 3],
          ['dianiaya sipir', 3], ['penganiayaan oleh petugas', 3],
          ['dipukuli petugas', 3], ['penyiksaan', 3], ['disiksa di lapas', 3],
          ['kekerasan oknum petugas', 3], ['pelecehan seksual oknum', 3],
          ['brutalitas petugas', 3], ['tewas penuh lebam', 3],
          ['penembakan oleh oknum', 3], ['oknum lapas menembak', 3],
          ['berujung kematian', 3], ['arogansi petugas', 3],
          // Penembakan oleh pegawai tidak selalu ditulis dengan kata
          // "penembakan". Judul "Tembak Pencuri Durian, Pegawai Lapas
          // Lubuklinggau Diperiksa" memakai bentuk kerja, dan bentuk itu
          // sebelumnya tidak pernah dicocokkan.
          [['tembak', 'pegawai'], 3], [['menembak', 'pegawai'], 3],
          [['tembak', 'sipir'], 3], [['tembak', 'petugas'], 3],
          ['diperiksa propam', 3], ['diperiksa inspektorat', 3],
          ['pemeriksaan internal', 2], ['diperiksa atasan', 2],
        ],
      },
      {
        kode: '3.4',
        nama: 'Jual-Beli Hak Warga Binaan',
        aktor: 'petugas',
        urgensi: 'Sedang',
        kunci: [
          ['suap remisi', 3], ['jual beli remisi', 3], ['suap asimilasi', 3],
          ['jual beli cuti bersyarat', 3], ['izin berobat fiktif', 3],
          ['suap pembebasan bersyarat', 3], ['calo remisi', 3],
          ['memperjualbelikan hak', 3], ['bayar untuk asimilasi', 3],
          ['plesiran napi', 3], ['napi keluar lapas tanpa izin', 3],
        ],
      },
      {
        kode: '3.5',
        nama: 'Dugaan Korupsi dan Penyalahgunaan Wewenang',
        aktor: 'petugas',
        urgensi: 'Tinggi',
        kunci: [
          [['kpk', 'imipas'], 3], [['kpk', 'pemasyarakatan'], 3],
          [['tersangka', 'kalapas'], 3], [['tersangka', 'karutan'], 3],
          [['korupsi', 'lapas'], 3], [['korupsi', 'rutan'], 3],
          [['sita aset', 'imipas'], 3], [['dicopot', 'kalapas'], 3],
          ['dugaan korupsi', 3], ['tindak pidana korupsi', 3], ['operasi tangkap tangan', 3],
          ['sita aset', 3], ['penyitaan aset', 3], ['penyalahgunaan wewenang', 3],
          ['pemerasan izin tinggal', 3], ['dilaporkan atas kasus', 3],
          ['diperiksa kejaksaan', 3], ['audit investigatif', 3], ['didesak audit', 3],
          ['dicopot dari jabatan', 3], ['dinonaktifkan', 2], ['diberhentikan', 2],
          ['sanksi disiplin', 2], ['pemeriksaan inspektorat', 3],
          [['menyita', 'aset'], 3], [['kpk', 'aset'], 2], [['sita', 'miliar'], 2],
          ['menyita aset', 3], ['nilai aset', 2], ['pengungkapan kasus', 2],
        ],
      },
      {
        kode: '3.6',
        nama: 'Dugaan Pelanggaran Etik dan Asusila',
        aktor: 'petugas',
        urgensi: 'Tinggi',
        kunci: [
          [['rumah dinas', 'kalapas'], 3], [['rumah dinas', 'kepala lapas'], 3],
          [['digerebek', 'rumah dinas'], 3], [['perempuan', 'rumah dinas'], 3],
          [['wanita', 'rumah dinas'], 3], [['gadis', 'kepala lapas'], 3],
          [['simpanan', 'lapas'], 3],
          ['penggerebekan rumah dinas', 3], ['rumah dinas kalapas', 3],
          ['asusila', 3], ['perselingkuhan', 3], ['video syur', 3], ['video mesum', 3],
          ['mesum', 3], ['wikwik', 3], ['pelecehan seksual', 3], ['tindak asusila', 3],
          ['punya simpanan', 3], ['skandal', 3], ['dugaan perzinaan', 3],
          ['pelanggaran kode etik', 3], ['pelanggaran etik', 3], ['sidang etik', 3],
          ['diduga berselingkuh', 3], ['hubungan terlarang', 3],
        ],
      },
    ],
  },

  {
    kode: '4',
    nama: 'Isu Manajemen, HAM, dan Krisis',
    ringkas: 'Manajemen & HAM',
    sifat: 'negatif',
    warna: 'tinggi',
    keterangan:
      'Kegagalan sistem, kelayakan hidup, dan insiden krisis yang bukan karena kesengajaan petugas atau warga binaan.',
    subkategori: [
      {
        kode: '4.1',
        nama: 'Kematian Tidak Wajar',
        aktor: 'campuran',
        urgensi: 'Tinggi',
        kunci: [
          [['tewas', 'lapas'], 3], [['tewas', 'rutan'], 3], [['meninggal', 'sel'], 3],
          [['tewas', 'napi'], 3], [['tewas', 'tahanan'], 3], [['lebam', 'tewas'], 3],
          [['meninggal', 'warga binaan'], 3], [['kematian', 'lapas'], 3],
          ['tewas di lapas', 3], ['tewas di rutan', 3], ['meninggal di sel', 3],
          ['napi tewas', 3], ['tahanan tewas', 3], ['gantung diri', 3],
          ['bunuh diri di sel', 3], ['kelalaian medis', 3],
          ['meninggal dunia di dalam', 3], ['ditemukan tak bernyawa', 3],
          ['jenazah warga binaan', 3], ['sakit tanpa penanganan', 3],
          ['korban meninggal dunia', 3], ['berujung kematian', 2],
          ['autopsi', 2], ['visum', 2],
        ],
      },
      {
        kode: '4.2',
        nama: 'Overkapasitas dan Kelayakan Hidup',
        aktor: 'sistem',
        urgensi: 'Rendah',
        kunci: [
          [['makanan', 'keluhan'], 3], [['makan', 'dikeluhkan'], 3],
          [['makanan', 'layak'], 2], [['keluhkan', 'makan'], 3],
          ['overkapasitas', 3], ['over kapasitas', 3], ['kelebihan kapasitas', 3],
          ['melebihi kapasitas', 3], ['kelebihan penghuni', 3], ['hunian sesak', 3],
          ['tidur berdesakan', 3], ['tidur menumpuk', 3], ['penghuni melebihi', 3],
          ['jatah makan', 3], ['porsi makan', 3], ['nasi dan tempe', 3],
          ['gizi warga binaan', 3], ['kualitas makanan', 3], ['makanan tidak layak', 3],
          ['scabies', 3], ['penyakit kulit', 2], ['wabah', 3],
          ['air bersih', 2], ['sanitasi', 2], ['bangunan miring', 3],
          ['bangunan keropos', 3], ['blok tidak layak', 3], ['atap bocor', 3],
          ['kondisi memprihatinkan', 3], ['sarana prasarana minim', 3],
          ['kekurangan petugas', 3], ['rasio petugas', 3], ['kelebihan beban', 2],
          [['bayi', 'rutan'], 3], [['bayi', 'lapas'], 3], [['balita', 'rutan'], 3],
          ['ikut ibunya', 3], ['anak balita di dalam', 3], ['ibu menyusui', 3],
          ['blok bangunan miring', 3], ['dikosongkan', 2], ['tidak layak huni', 3],
          // Kesehatan penghuni adalah persoalan kelayakan hidup, bukan berita
          // kesehatan biasa. Sebelum ini seluruhnya jatuh ke "Lainnya".
          ['rawan hipertensi', 3], ['gula darah', 3], ['penyakit menular', 3],
          ['kesehatan warga binaan', 3], ['kesehatan napi', 3], ['rawan penyakit', 3],
          ['tbc di lapas', 3], ['hiv di lapas', 3], ['gizi buruk', 3],
          ['penganggaran makanan', 3], ['anggaran makan', 3], ['anggaran makanan', 3],
          ['biaya makan warga binaan', 3], ['bama', 2],
          // Keluhan atas layanan yang disampaikan terbuka di depan unit.
          ['meluapkan kemarahan', 3], ['memprotes', 3], ['lambannya proses', 3],
          ['proses berlarut', 3], ['dipersulit', 3], ['mengeluhkan layanan', 3],
          [['protes', 'pembebasan'], 3], [['keluarga', 'protes'], 2],
        ],
        pola: [
          [/\bkapasitas\s+\d{1,4}\b[^.]{0,50}\b(dihuni|penghuni|diisi|berisi)\b/, 3],
          [/\b(dihuni|penghuni|diisi)\b[^.]{0,40}\bkapasitas\s+\d{1,4}\b/, 3],
          [/\bhuni(an)?\s+\d{2,3}\s*persen\b/, 2],
          [/\bkapasitas\s+\d{1,4}\b[^.]{0,60}\b\d{2,4}\s+(warga binaan|napi|narapidana|tahanan|orang)\b/, 3],
        ],
      },
      {
        kode: '4.3',
        nama: 'Bencana dan Insiden Alam',
        aktor: 'sistem',
        urgensi: 'Tinggi',
        kunci: [
          ['kebakaran lapas', 3], ['kebakaran rutan', 3], ['lapas terbakar', 3],
          ['rutan terbakar', 3], ['korsleting', 3], ['lapas banjir', 3],
          ['rutan banjir', 3], ['gempa', 2], ['evakuasi warga binaan', 3],
          ['kebakaran aula', 3], ['dievakuasi', 3], ['api membakar', 3],
          ['pemadam kebakaran', 3], ['tanah longsor', 3], ['pohon tumbang', 2],
        ],
      },
    ],
  },

  {
    kode: '5',
    nama: 'Isu Intelijen Khusus',
    ringkas: 'Radikalisme',
    sifat: 'negatif',
    warna: 'kritis',
    keterangan:
      'Aktivitas narapidana terorisme dan penyebaran paham yang membahayakan ideologi negara.',
    subkategori: [
      {
        kode: '5.1',
        nama: 'Penyebaran Paham Radikal',
        aktor: 'wbp',
        urgensi: 'Tinggi',
        kunci: [
          ['napiter', 3], ['narapidana terorisme', 3], ['pembaiatan', 3], ['baiat', 3],
          ['doktrinasi', 3], ['radikalisasi', 3], ['paham radikal', 3],
          ['kelompok eksklusif', 3], ['terorisme di lapas', 3], ['jaringan teroris', 3],
          ['ekstremisme', 3], ['perekrutan di lapas', 3], ['densus', 2],
          ['sel teroris', 3], ['propaganda radikal', 3],
        ],
      },
      {
        kode: '5.2',
        nama: 'Penolakan Program Deradikalisasi',
        aktor: 'wbp',
        urgensi: 'Tinggi',
        kunci: [
          ['menolak ikrar', 4], ['ikrar setia nkri', 4], ['tolak hormat bendera', 4],
          ['menolak upacara', 4], ['menolak deradikalisasi', 4],
          ['tolak ikuti upacara', 4], ['tolak ikrar', 4],
          ['menolak pembinaan ideologi', 3], ['mengurung diri di sel', 3],
          ['tidak mau berinteraksi dengan pamong', 3],
        ],
      },
    ],
  },

  {
    kode: '6',
    nama: 'Ancaman Eksternal dan Modus Baru',
    ringkas: 'Ancaman Eksternal',
    sifat: 'negatif',
    warna: 'tinggi',
    keterangan:
      'Ancaman yang berasal dari luar tembok, bukan kelalaian dari dalam. Petugas biasanya berperan menggagalkan.',
    subkategori: [
      {
        kode: '6.1',
        nama: 'Penyelundupan Modus Baru',
        aktor: 'eksternal',
        urgensi: 'Sedang',
        kunci: [
          [['selundup', 'lapas'], 3], [['selundup', 'rutan'], 3],
          [['selundup', 'narkoba'], 3], [['selundup', 'pengunjung'], 3],
          ['penyelundupan', 3], ['menyelundupkan', 3], ['diselundupkan', 3],
          ['dilempar dari luar tembok', 3], ['pelemparan barang', 3],
          ['dilempar ke dalam lapas', 3], ['drone', 3], ['pesawat tanpa awak', 3],
          ['penyelundupan digagalkan', 3], ['gagalkan penyelundupan', 3],
          ['upaya penyelundupan', 3], ['modus baru penyelundupan', 3],
          ['disembunyikan dalam makanan', 3], ['paket mencurigakan', 3],
          ['lauk nasi bungkus', 3], ['karet celana', 3], ['area kemaluan', 3],
          ['lewat anus', 3], ['disembunyikan di tubuh', 3], ['modus baru', 2],
          ['pengunjung wanita diamankan', 3], ['barang terlarang', 2],
          ['titipan mencurigakan', 3], ['lemparan tembok', 3], ['modus lempar', 3],
          ['pelemparan', 3], ['dilempar', 3], ['otk', 2], ['orang tak dikenal', 3],
          ['pemasok narkoba', 3], ['memasok narkoba', 3], ['jalur masuk narkoba', 3],
          ['dititipkan lewat', 3], ['disamarkan', 3],
          [['paket', 'dilempar'], 3], [['lempar', 'tembok'], 3],
        ],
        pola: [[/\b(selundup|seludup)/, 2]],
      },
      {
        kode: '6.2',
        nama: 'Penyerangan Fisik Eksternal',
        aktor: 'eksternal',
        urgensi: 'Tinggi',
        kunci: [
          ['penyerangan lapas', 3], ['penyerangan rutan', 3], ['diserang massa', 3],
          ['demonstrasi di depan lapas', 3], ['unjuk rasa di gerbang', 3],
          ['demo lapas', 3], ['demo rutan', 3], ['lsm demo', 3],
          ['pembebasan paksa', 3], ['kelompok bersenjata', 3],
          ['penyerbuan', 3], ['pengepungan lapas', 3], ['pengerahan massa', 3],
          ['aksi damai', 3], ['aksi unjuk rasa', 3], ['menuntut penangguhan', 3],
          ['orasi', 3], ['spanduk protes', 3],
          [['aksi', 'rutan'], 2], [['aksi', 'lapas'], 2], [['demo', 'lapas'], 3],
        ],
      },
    ],
  },

  {
    kode: '7',
    nama: 'Disinformasi dan Kegagalan Integrasi',
    ringkas: 'Intelijen Media',
    sifat: 'negatif',
    warna: 'sedang',
    keterangan:
      'Isu yang berdampak pada manajemen krisis, reputasi, dan pembentukan opini publik terhadap Ditjen PAS.',
    subkategori: [
      {
        kode: '7.1',
        nama: 'Hoaks dan Kampanye Hitam',
        aktor: 'eksternal',
        urgensi: 'Sedang',
        kunci: [
          [['klarifikasi', 'viral'], 3], [['klarifikasi', 'pemberitaan'], 3],
          [['membantah', 'isu'], 3], [['bantah', 'sarang'], 3],
          [['video', 'kasus lama'], 3], [['ternyata', 'kasus lama'], 3],
          [['bukan', 'kabur'], 2], [['dikaitkan', 'viral'], 2],
          ['hoaks', 3], ['hoax', 3], ['berita palsu', 3], ['disinformasi', 3],
          ['video lama', 3], ['kejadian lama', 3], ['kasus lama', 3],
          ['klarifikasi', 3], ['membantah', 3], ['kabar bohong', 3],
          ['mendiskreditkan', 3], ['framing negatif', 3], ['viral kembali', 3],
          ['bukan kejadian baru', 3], ['daur ulang video', 3], ['isu terpatahkan', 3],
          ['beri penjelasan', 2], ['meluruskan', 3], ['tidak benar', 2],
          ['isu tidak berdasar', 3], ['diluruskan', 3], ['buka suara', 3],
          ['jadi sorotan', 2], ['sorotan warganet', 3], ['ramai diperbincangkan', 3],
          ['beredar di media sosial', 3], ['kembali beredar', 3],
          ['mengungkap fakta', 3], ['fakta sebenarnya', 3], ['diintimidasi', 2],
          ['direkam tahun', 3], ['unggahan lama', 3],
        ],
        pola: [
          [/\bdirekam\s+(pada\s+)?(tahun\s+)?(19|20)\d{2}\b/, 3],
          [/\bviral\b[^.]{0,50}\b(lama|klarifikasi|bantah|luruskan)/, 2],
        ],
      },
      {
        kode: '7.2',
        nama: 'Kegagalan Program Integrasi',
        aktor: 'wbp',
        urgensi: 'Sedang',
        kunci: [
          [['residivis', 'ditangkap'], 3], [['baru bebas', 'ditangkap'], 3],
          [['bebas', 'kembali ditangkap'], 3],
          ['residivis', 3], ['baru bebas', 3], ['baru keluar lapas', 3],
          ['baru keluar penjara', 3], ['bebas asimilasi', 2],
          ['kembali ditangkap polisi', 3], ['mengulangi kejahatan', 3],
          ['berulah setelah bebas', 3], ['napi asimilasi berulah', 3],
          ['kembali berulah', 3], ['eks napi', 2], ['mantan narapidana', 2],
        ],
      },
    ],
  },

  {
    kode: '8',
    nama: 'Narasi Positif dan Kehumasan',
    ringkas: 'Narasi Positif',
    sifat: 'positif',
    warna: 'positif',
    keterangan:
      'Pemberitaan yang menguatkan citra institusi. Dipakai sebagai bahan counter-narrative dalam laporan.',
    subkategori: [
      {
        kode: '8.1',
        nama: 'Remisi dan Reintegrasi',
        aktor: 'sistem',
        urgensi: 'Rendah',
        kunci: [
          ['remisi', 3], ['remisi umum', 3], ['pembebasan bersyarat', 3],
          ['cuti bersyarat', 3], ['cuti menjelang bebas', 3], ['reintegrasi sosial', 3],
          ['langsung bebas', 3], ['menerima remisi', 3], ['diusulkan dapat remisi', 3],
          ['usulan remisi', 3], ['program asimilasi', 2], ['integrasi sosial', 3],
          ['pengurangan masa pidana', 3], ['bebas murni', 3],
        ],
        pola: [[/\b\d{2,4}\s+(napi|narapidana|warga binaan|tahanan)\b[^.]{0,40}\bremisi\b/, 3]],
      },
      {
        kode: '8.2',
        nama: 'Pembinaan, Pendidikan, dan Keagamaan',
        aktor: 'sistem',
        urgensi: 'Rendah',
        // Dipersempit 4 September 2026. Sebelumnya subkategori ini bernama
        // "Pembinaan dan Kemandirian" dan menampung dua hal yang sebenarnya
        // berbeda: pembinaan kepribadian (pelatihan, sekolah, ibadah) dan
        // pemberdayaan ekonomi (panen, budidaya, UMKM). Keduanya sama-sama
        // positif, sehingga tidak ada yang keliru selama laporan hanya
        // menghitung positif-negatif. Begitu laporan mulai menguraikan isu
        // per tema, gabungan itu menjadi satu batang raksasa tanpa arti.
        // Yang berhubungan dengan pangan dan usaha pindah ke 8.6.
        kunci: [
          ['pelatihan kerja', 3], ['bimbingan kerja', 3], ['bimker', 3],
          ['keterampilan', 3], ['bekal keterampilan', 3],
          ['pesantren', 3], ['kegiatan keagamaan', 3],
          ['pembinaan rohani', 3], ['kerohanian', 3], ['pembinaan agama', 3],
          ['pendidikan kesetaraan', 3], ['belajar paket', 3], ['sertifikasi', 2],
          ['magang', 3], ['maganghub', 3], ['peserta magang', 3],
          ['program pemagangan', 3], ['kemnaker', 3], ['pelatihan vokasi', 3],
          ['kelas menjahit', 3], ['pembinaan kepribadian', 3],
          ['literasi', 2], ['perpustakaan', 2], ['penyuluhan hukum', 3],
          ['kesadaran hukum', 3], ['kuliah teologi', 3], ['berdakwah', 3],
          ['berdzikir', 3], ['pengajian', 3], ['ibadah bersama', 3],
          ['batik', 3], ['menjahit', 3], ['las', 2], ['barbershop', 3],
          ['cukur rambut', 3], ['probation officer', 3], ['pembimbing kemasyarakatan', 3],
          ['asesmen', 2], ['kurikulum', 2], ['beasiswa', 3], ['ujian kesetaraan', 3],
          [['pelatihan', 'warga binaan'], 3],
          // Ibadah rutin adalah pembinaan kepribadian, dan ia salah satu isi
          // unggahan humas yang paling sering muncul.
          ['ibadah', 3], ['kebaktian', 3], ['misa', 3], ['salat berjamaah', 3],
          ['sholat berjamaah', 3], ['tadarus', 3], ['khotbah', 3], ['jemaat', 3],
          ['rohani', 3], ['siraman rohani', 3], ['bimbingan rohani', 3],
          // Hari besar keagamaan adalah pemicu paling sering bagi kegiatan
          // keagamaan di UPT, dan judulnya kerap hanya menyebut nama harinya.
          ['maulid nabi', 3], ['isra mikraj', 3], ['isra miraj', 3],
          ['nuzulul quran', 3], ['tahun baru islam', 3], ['idul fitri', 2],
          ['idul adha', 2], ['natal', 2], ['paskah', 2], ['nyepi', 2],
          ['waisak', 2], ['doa bersama', 3], ['istighosah', 3], ['kajian', 2],
          ['ceramah agama', 3], ['khataman', 3], ['santri', 2],
        ],
      },
      {
        kode: '8.3',
        nama: 'Layanan Dasar, Hak, dan Bakti Sosial',
        aktor: 'sistem',
        urgensi: 'Rendah',
        // Dipersempit 4 September 2026 bersama 8.2. Yang berhubungan dengan
        // kesehatan pindah ke 8.7; alasannya sama, dan kesehatan adalah tema
        // yang paling sering ditanyakan tersendiri oleh pimpinan.
        kunci: [
          ['bakti sosial', 3], ['baksos', 3],
          ['bansos', 3], ['sembako', 3], ['santunan', 3],
          ['berbagi', 2], ['bantuan sosial', 3], ['santunan anak yatim', 3],
          ['baznas', 3], ['rumah layak huni', 3], ['bedah rumah', 3],
          ['layanan prima', 3], ['pelayanan publik', 3], ['digitalisasi layanan', 3],
          ['maklumat pelayanan', 3], ['layanan kunjungan', 3], ['alur pelayanan', 3],
          ['aplikasi layanan', 3], ['tidak dipungut biaya', 3], ['bebas pungli', 3],
          ['zona integritas', 3], ['wbk', 3], ['wbbm', 3],
          ['penghargaan', 3], ['raih predikat', 3], ['meraih penghargaan', 3],
          ['prestasi', 2], ['inovasi', 3], ['juara', 3], ['peringkat terbaik', 3],
          ['sabet juara', 3], ['kolaborasi', 2], ['sinergi', 3], ['kerja sama', 2],
          ['wartelsuspas', 3], ['layanan komunikasi', 3], ['video call', 3],
          ['kunjungan keluarga', 3], ['layanan pengaduan', 3], ['sampaikan keluhan', 3],
          ['transaksi non tunai', 3], ['brizzi', 3], ['perbankan', 2],
          ['duta layanan', 3], ['duta', 2], ['kesempatan kedua', 3],
          ['peduli sesama', 3],
          ['ada keluhan', 3], ['kotak saran', 3], ['survei kepuasan', 3],
          ['jejak kasih', 3], ['rindu keluarga', 3], ['kasih sayang keluarga', 3],
          ['pertemuan keluarga', 3], ['temu keluarga', 3], ['berbagi senyum', 3],
          ['kebahagiaan bersama warga binaan', 3],
          ['kesejahteraan keluarga', 3], [['kesejahteraan', 'warga binaan'], 3],
          ['kesejahteraan warga binaan', 3], ['perhatian pemerintah daerah', 3],
          // Hak dasar warga binaan yang bukan remisi. Tanpa penyebutan ini,
          // berita bantuan hukum dan perlengkapan dasar jatuh ke "Lainnya".
          ['bantuan hukum', 3], ['posbakum', 3], ['penyuluh hukum', 3],
          ['hak warga binaan', 3], ['perlengkapan dasar', 3], ['kasur', 2],
          ['air bersih', 3], ['sanitasi', 3], ['makanan layak', 3],
          ['dapur higienis', 3], ['menu makanan', 3], ['bahan makanan', 2],
        ],
      },
      {
        kode: '8.4',
        nama: 'Kegiatan Seremonial dan Kelembagaan',
        aktor: 'sistem',
        urgensi: 'Rendah',
        kunci: [
          ['hari pengayoman', 3], ['upacara', 3], ['upacara bendera', 3],
          ['apel pagi', 3], ['apel', 2], ['pelantikan', 3],
          ['serah terima jabatan', 3], ['sertijab', 3], ['pelepasan pejabat', 3],
          ['kenaikan pangkat', 3], ['rapat koordinasi', 3], ['rapat tusi', 3],
          ['penandatanganan', 3], ['nota kesepahaman', 3], ['peresmian', 3],
          ['peninjauan', 2], ['audiensi', 3], ['kunjungan kerja', 3],
          ['menerima kunjungan', 3], ['silaturahmi', 3], ['halalbihalal', 3],
          ['hari ulang tahun', 3], ['hut ke', 3], ['dirgahayu', 3],
          ['hari kemerdekaan', 3], ['semarak kemerdekaan', 3], ['semarak hut', 3],
          ['peringatan hari', 3], ['kemerdekaan republik indonesia', 3],
          ['lomba', 3], ['perlombaan', 3], ['turnamen', 3], ['porseni', 3],
          ['pekan olahraga', 3], ['fun walk', 3], ['funwalk', 3], ['jalan sehat', 3],
          ['gerak jalan', 3], ['senam bersama', 3], ['senam sehat', 3],
          ['senam ceria', 3], ['tarik tambang', 3], ['lomba catur', 3],
          ['tenis meja', 3], ['futsal', 3], ['memancing', 3], ['karnaval', 3],
          ['pawai', 3], ['aksi bersih', 3], ['kerja bakti', 3], ['gotong royong', 3],
          ['umbul umbul', 3], ['lomba musik', 3], ['jingle', 3], ['buletin sepekan', 3],
          ['pembukaan', 2], ['penutupan', 2], ['latsar', 3], ['cpns', 2],
          ['kick off', 3], ['selamat datang', 2], ['presentasi laporan', 2],
          ['kuliah kerja nyata', 3], ['praktik kerja lapangan', 3],
          ['apel bersama', 3], ['apel gabungan', 3], ['porsenap', 3],
          ['bulutangkis', 3], ['badminton', 3], ['bola voli', 3], ['sepak bola', 3],
          ['gerak jalan bersama', 3], ['jalan santai', 3], ['pentas seni', 3],
          ['gor', 2], ['rapat analisis', 3], ['rapat evaluasi', 3],
          ['bimbingan teknis', 3], ['bimtek', 3], ['workshop', 2],
          ['sosialisasi', 2], ['penyerahan penghargaan', 3], ['piala', 2],
          ['perpisahan', 3], ['purna tugas', 3], ['pisah sambut', 3],
          ['pengambilan sumpah', 3], ['pengukuhan', 3],
          ['lhp bpk', 3], ['laporan hasil pemeriksaan', 3], ['bpk', 2],
          ['pegawai terbaik', 3], ['penguatan', 2], ['bertekad', 2],
          ['dialog', 2], ['podcast', 2], ['talkshow', 3], ['siaran', 2],
          ['media sosial', 2], ['follow', 2], ['konten', 2],
          // Ucapan selamat dan kunjungan tamu adalah dua bentuk unggahan
          // kehumasan paling lazim, dan keduanya belum punya kata kuncinya.
          ['mengucapkan selamat', 3], ['hari jadi', 3], ['ulang tahun', 3],
          ['turut mengucapkan', 3], ['keluarga besar', 2],
          ['berkunjung ke lapas', 3], ['berkunjung ke rutan', 3],
          ['kunjungan ke lapas', 3], ['kunjungan ke rutan', 3],
          ['meninjau', 3], ['tinjau program', 3], ['mendampingi', 2],
          ['pengabdian', 3], ['highlight kegiatan', 3], ['satu pekan', 2],
          ['tennis meja', 3], ['tenis lapangan', 3], ['olahraga bersama', 3],
          // Pembangunan sarana adalah kabar kelembagaan, bukan isu.
          ['progres pembangunan', 3], ['pembangunan rutan', 3], ['pembangunan lapas', 3],
          ['gedung baru', 3], ['menara pengawas', 3], ['pagar pengaman', 3],
          ['sensus', 3], ['pendataan', 2],
        ],
      },
      {
        kode: '8.5',
        nama: 'Operasional dan Pengamanan Rutin',
        aktor: 'sistem',
        urgensi: 'Rendah',
        kunci: [
          ['razia', 3], ['razia insidentil', 3], ['razia blok hunian', 3],
          ['razia kamar hunian', 3], ['penggeledahan', 3], ['penggeledahan kamar', 3],
          ['penggeledahan badan', 3], ['sidak', 3], ['inspeksi mendadak', 3],
          ['daily inspection', 3], ['deteksi dini', 3], ['tes urine', 3],
          ['tes urin', 3], ['pemindahan warga binaan', 3], ['pemindahan narapidana', 3],
          ['relokasi warga binaan', 3], ['dipindahkan ke lapas', 3],
          ['pengamanan berlapis', 3], ['izin keluar luar biasa', 3], ['iklb', 3],
          ['pengawalan', 3], ['operasi bersih', 3], ['apel siaga', 3],
          ['patroli', 3], ['kesiapsiagaan', 3], ['monitoring blok', 3],
          ['papan kontrol', 3], ['kontrol blok hunian', 3], ['perketat pengawasan', 3],
          ['nihil hp dan narkoba', 3], ['nihil temuan', 3], ['jaga kondusivitas', 3],
          ['kondusif', 3], ['antisipasi', 2], ['pencegahan', 2],
          ['digagalkan', 2], ['berhasil menggagalkan', 3], ['diamankan petugas', 3],
          ['pemindahan', 2], ['dipindahkan', 2], ['pengamanan pemindahan', 3],
          ['pengawalan pemindahan', 3], ['lapas baru', 3], ['pengetatan pengawasan', 3],
          ['penguatan pengamanan', 3], ['simulasi', 2], ['gladi', 2],
          ['cek rutin tahanan', 3], ['pengecekan blok', 3],
          ['eksekusi terpidana', 3], ['penyerahan terpidana', 3], ['titipan tahanan', 3],
          ['penerimaan tahanan', 3], ['dieksekusi ke rutan', 3], ['dijebloskan', 3],
          // Pengawasan malam dan sidang TPP adalah pekerjaan rutin yang paling
          // sering diunggah humas, dan keduanya belum pernah tertangkap.
          ['kontrol malam', 3], ['kontrol rutin', 3], ['ronda malam', 3],
          ['sidang tpp', 3], ['tim pengamat pemasyarakatan', 3], ['sidang tim pengamat', 3],
          ['apar', 3], ['alat pemadam api', 3], ['simulasi kebakaran', 3],
          ['latihan pemadaman', 3], ['damkar', 2], ['siaga bencana', 3],
          [['eksekusi', 'terpidana'], 3], [['eksekusi', 'rutan'], 3],
          [['kejari', 'rutan'], 2], [['kejaksaan', 'rutan'], 2],
        ],
        pola: [
          [/\brazia\b/, 1],
          [/\bpemindahan\s+\d{1,4}\s*(orang\s*)?(narapidana|napi|warga binaan|tahanan)/, 3],
          [/\b\d{2,4}\s+(narapidana|warga binaan|tahanan)\b[^.]{0,30}\bdipindahkan\b/, 3],
        ],
      },
      {
        kode: '8.6',
        nama: 'Ketahanan Pangan dan Pemberdayaan Ekonomi',
        aktor: 'sistem',
        urgensi: 'Rendah',
        // Dipisahkan dari 8.2 pada 4 September 2026. Panen, budidaya, dan
        // produksi warga binaan adalah program nasional tersendiri dengan
        // target dan pelaporannya sendiri; menyatukannya dengan pelatihan dan
        // ibadah membuat capaiannya tidak pernah bisa dibaca sebagai angka.
        kunci: [
          ['ketahanan pangan', 3], ['panen', 3], ['panen raya', 3],
          ['budidaya', 3], ['hidroponik', 3], ['berkebun', 3],
          ['pertanian', 2], ['peternakan', 2], ['perikanan', 2],
          ['pembibitan', 3], ['bibit', 2], ['pupuk', 2], ['lahan', 2],
          ['sayur', 2], ['sayuran', 3], ['pakcoy', 3], ['terong', 3],
          ['sawi', 3], ['cabai', 3], ['jagung', 3], ['padi', 3],
          ['kolam ikan', 3], ['lele', 3], ['nila', 3], ['ayam petelur', 3],
          ['kambing', 2], ['sapi', 2], ['maggot', 3],
          ['kemandirian', 3], ['umkm', 3], ['wirausaha', 3], ['modal hidup', 3],
          ['produksi warga binaan', 3], ['karya warga binaan', 3],
          ['bengkel kerja', 3], ['pembuatan tempe', 3], ['pembuatan sabun', 3],
          ['sabut kelapa', 3], ['diekspor', 3], ['ekspor', 2],
          ['memasak', 3], ['dapur', 2],
          ['pendapatan negara bukan pajak', 3], ['pnbp', 3],
          ['hasil produksi', 3], ['omzet', 3], ['pemasaran produk', 3],
          [['karya', 'warga binaan'], 3], [['karya', 'lapas'], 2],
          [['produk', 'warga binaan'], 3], [['panen', 'lapas'], 3],
          [['panen', 'rutan'], 3],
        ],
        pola: [
          [/\bpanen\s+\d{1,4}\s*(kg|kilogram|ton|kwintal)/, 3],
          [/\bmendukung\s+(program\s+)?ketahanan pangan\b/, 3],
        ],
      },
      {
        kode: '8.7',
        nama: 'Kesehatan dan Layanan Medis',
        aktor: 'sistem',
        urgensi: 'Rendah',
        // Dipisahkan dari 8.3 pada 4 September 2026. Kesehatan warga binaan
        // adalah tema yang ditanyakan tersendiri — kapasitas klinik, rujukan,
        // wabah — dan selama ia menumpang di keranjang layanan umum, tidak ada
        // satu pun angka yang bisa menjawab pertanyaan itu.
        kunci: [
          ['donor darah', 3], ['setetes darah', 3], ['kantong darah', 3],
          ['pmi', 2], ['cek kesehatan gratis', 3], ['ckg', 3],
          ['pemeriksaan kesehatan gratis', 3], ['pemeriksaan gratis', 3],
          ['pengobatan gratis', 3], ['layanan kesehatan', 3],
          ['pemeriksaan kesehatan', 3], ['skrining', 3], ['skrining tbc', 3],
          ['posyandu', 3], ['klinik', 3], ['vitamin', 2], ['peduli kesehatan', 3],
          ['imunisasi', 3], ['vaksinasi', 3], ['rehabilitasi medis', 3],
          ['gizi seimbang', 3], ['tenaga medis', 3], ['dokter', 2],
          ['perawat', 2], ['puskesmas', 3], ['rumah sakit', 2], ['rujukan', 2],
          ['rujuk ke rumah sakit', 3], ['bpjs', 3], ['jaminan kesehatan', 3],
          ['jkn', 3], ['tuberkulosis', 3], ['tbc', 3], ['hiv', 3],
          ['scabies', 3], ['kudis', 3], ['wabah', 3], ['penyakit menular', 3],
          ['kesehatan warga binaan', 3], ['kesehatan wbp', 3],
          ['rehabilitasi narkoba', 3], ['rehabilitasi sosial', 2],
          ['kesehatan jiwa', 3], ['psikolog', 3], ['konseling', 2],
          ['obat', 2], ['apotek', 3], ['poliklinik', 3],
          [['layanan', 'kesehatan'], 3], [['pemeriksaan', 'warga binaan'], 2],
        ],
        pola: [
          [/\b(dirujuk|dilarikan)\s+ke\s+(rs|rumah sakit|puskesmas)/, 3],
        ],
      },
    ],
  },
]

/** Kategori cadangan ketika tidak ada satu pun subkategori yang cukup meyakinkan. */
export const KATEGORI_LAINNYA = {
  kode: '0',
  nama: 'Lainnya',
  ringkas: 'Lainnya',
  sifat: 'netral',
  warna: 'netral',
  keterangan: 'Belum dapat dikelompokkan oleh mesin. Menunggu telaah analis.',
  subkategori: [
    { kode: '0.1', nama: 'Belum Dikelompokkan', aktor: 'tidak diketahui', urgensi: 'Rendah', kunci: [] },
  ],
}

/**
 * Kategori untuk berita yang memang bukan urusan Pemasyarakatan.
 *
 * Dua rombongan besar yang selama ini mengotori arsip. Pertama, rumah tahanan
 * milik lembaga lain — Rutan KPK, Rutan Bareskrim, rutan militer — yang tertarik
 * masuk karena kata "rutan". Kedua, unggahan berbahasa asing yang kebetulan
 * memuat rangkaian huruf "bapas" atau "lapas" dan sama sekali bukan berita.
 *
 * Keduanya sengaja dipisahkan dari "Lainnya". "Lainnya" berarti mesin belum
 * mampu menilai dan analis perlu melihat; kategori ini berarti tidak ada yang
 * perlu dilihat. Angka pada laporan dihitung tanpa kategori ini.
 */
export const KATEGORI_LUAR_LINGKUP = {
  kode: '9',
  nama: 'Di Luar Lingkup',
  ringkas: 'Luar Lingkup',
  sifat: 'netral',
  warna: 'netral',
  keterangan: 'Bukan peristiwa pada unit pelaksana teknis Pemasyarakatan. Tidak dihitung dalam statistik laporan.',
  subkategori: [
    { kode: '9.1', nama: 'Unit Non-Pemasyarakatan', aktor: 'tidak diketahui', urgensi: 'Rendah', kunci: [] },
    { kode: '9.2', nama: 'Konten Tidak Relevan', aktor: 'tidak diketahui', urgensi: 'Rendah', kunci: [] },
  ],
}

/**
 * Rumah tahanan dan fasilitas penahanan milik lembaga di luar Ditjen
 * Pemasyarakatan. Penyebutannya menutup berita dari perhitungan, sebab
 * kejadian di sana bukan tanggung jawab Direktorat Pengamanan dan Intelijen.
 */
export const PENANDA_LEMBAGA_LAIN = [
  'rutan kpk', 'rutan komisi pemberantasan korupsi', 'rutan bareskrim',
  'rutan cabang gedung merah putih', 'rutan gedung merah putih',
  'rutan mabes polri', 'rutan polda', 'rutan polres', 'rutan polresta',
  'rutan polsek', 'rutan mako brimob', 'rutan militer', 'rutan pomdam',
  'rutan puspom', 'rutan kejaksaan', 'rutan kejati', 'rutan kejari',
  'rutan guntur', 'rumah tahanan militer', 'rutan imigrasi',
  'panti rehabilitasi', 'pusat rehabilitasi narkoba', 'lapas militer',
  'ruang tahanan polres', 'ruang tahanan polsek', 'sel polres', 'sel mapolres',
  // Pemberitaan lembaga pemasyarakatan di luar negeri. Sering tertarik masuk
  // karena kata "lapas" atau "penjara" pada terjemahan judulnya.
  'penjara israel', 'lapas israel', 'penjara malaysia', 'penjara filipina',
  'penjara amerika', 'penjara singapura', 'penjara thailand', 'penjara el salvador',
  'penjara guantanamo', 'menteri israel',
  // Penahanan di markas kepolisian sering ditulis tanpa kata "rutan" sama
  // sekali — justru sebagai lawan katanya: "ditahan di Brimob, bukan Rutan".
  // Tanpa penanda di bawah ini, berita semacam itu dibaca sebagai urusan
  // Pemasyarakatan padahal ia justru menegaskan sebaliknya.
  'ditahan di brimob', 'ditahan di mako brimob', 'mako brimob', 'brimob',
  'ditahan di polda', 'ditahan di polres', 'ditahan di mabes',
  'ditahan di kejaksaan', 'ditahan di kejagung', 'rutan kejagung',
]

/**
 * Kata yang memastikan teks memang berbahasa Indonesia. Dipakai hanya sebagai
 * penjaga terakhir: bila mesin tidak menemukan apa pun DAN tidak ada satu pun
 * kata di bawah ini, teks itu hampir pasti bukan berita Indonesia.
 */
export const KATA_FUNGSI_INDONESIA = [
  'dan', 'di', 'ke', 'yang', 'dengan', 'untuk', 'dari', 'pada', 'ini', 'itu',
  'akan', 'telah', 'sudah', 'tidak', 'para', 'oleh', 'dalam', 'saat', 'juga',
  'adalah', 'atau', 'serta', 'bagi', 'kepada', 'sebagai', 'karena', 'agar',
  'lebih', 'bisa', 'ada', 'kami', 'kita', 'mereka', 'bersama', 'menjadi',
  'seorang', 'sebuah', 'setelah', 'sebelum', 'hingga', 'sampai', 'namun',
  'tetapi', 'bahwa', 'kembali', 'masih', 'baru', 'gelar', 'ikuti', 'sambut',
  'rangka', 'kegiatan', 'warga', 'binaan', 'petugas', 'pegawai', 'laksana',
  'terima', 'hadir', 'adakan', 'lakukan', 'berikan', 'jalani', 'antar',
  'lewat', 'atas', 'bawah', 'tanpa', 'sejak', 'tiap', 'setiap', 'semua',
  'seluruh', 'banyak', 'orang', 'tahun', 'hari', 'bulan', 'resmi', 'jadi',
  'punya', 'milik', 'guna', 'demi', 'sesuai', 'terkait', 'tentang', 'soal',
  'kota', 'kabupaten', 'provinsi', 'negara', 'kepala', 'kantor', 'wilayah',
  // Daftar di atas ternyata masih terlalu pendek. Judul "Kunjungan lapas
  // narkoba sie sosial gereja katolik St. Paulus Labuhbaru Pekanbaru" tidak
  // memuat satu pun kata di atas, dan karena itu dituduh bukan berbahasa
  // Indonesia lalu dibuang sebagai konten tidak relevan. Nama bulan, kata
  // benda sehari-hari, dan kata kerja lazim melengkapi daftarnya.
  'januari', 'februari', 'maret', 'april', 'mei', 'juni', 'juli', 'agustus',
  'september', 'oktober', 'november', 'desember',
  'kunjungan', 'sosial', 'gereja', 'masjid', 'sekolah', 'keluarga', 'anak',
  'ibu', 'bapak', 'pagi', 'siang', 'malam', 'kerja', 'program', 'layanan',
  'bantuan', 'dukungan', 'harapan', 'semangat', 'pertemuan', 'rapat',
  'menggelar', 'mengikuti', 'melaksanakan', 'memberikan', 'menerima',
  'bersama', 'sesuai', 'selamat', 'terus', 'dapat', 'perlu', 'sedang',
  'antara', 'selama', 'melalui', 'terhadap', 'menurut', 'sekitar', 'usai',
  'sebanyak', 'sejumlah', 'beberapa', 'seluruhnya', 'masing',
]

/** Penanda inti Pemasyarakatan. Tanpa salah satunya, berita tidak dianggap terkait. */
export const JANGKAR_PEMASYARAKATAN = [
  'lapas', 'rutan', 'lpka', 'lpp', 'bapas', 'pemasyarakatan', 'warga binaan',
  'wbp', 'napi', 'narapidana', 'tahanan', 'sipir', 'ditjenpas', 'kemenimipas',
  'imipas', 'kalapas', 'karutan', 'penjara', 'lembaga pemasyarakatan',
  'rumah tahanan', 'balai pemasyarakatan', 'terpidana', 'ditjen pas',
  // Berita tentang bekas warga binaan tidak selalu menyebut nama unitnya.
  // Tanpa jangkar di bawah ini, kegagalan program integrasi ikut terbuang.
  'residivis', 'asimilasi', 'remisi', 'pembebasan bersyarat', 'cuti bersyarat',
  'eks napi', 'mantan narapidana', 'napiter', 'pemasyarakatan',
]

/**
 * Jangkar yang berdiri sendiri belum membuktikan apa-apa. Kata "lapas" dan
 * "bapas" muncul juga pada unggahan berbahasa Hindi dan Spanyol. Yang di bawah
 * ini khas Indonesia dan khas Pemasyarakatan, sehingga kemunculannya cukup
 * untuk memastikan berita memang relevan.
 */
export const JANGKAR_KUAT = [
  'pemasyarakatan', 'warga binaan', 'wbp', 'napi', 'narapidana', 'sipir',
  'ditjenpas', 'kemenimipas', 'imipas', 'kalapas', 'karutan', 'terpidana',
  'lembaga pemasyarakatan', 'rumah tahanan', 'balai pemasyarakatan', 'tahanan',
]

/**
 * Penanda unggahan resmi humas UPT. Tidak menentukan subkategori sendiri,
 * hanya memberi keyakinan tambahan pada kategori positif ketika tidak ada
 * satu pun indikasi negatif yang lebih kuat.
 */
export const PENANDA_KEHUMASAN = [
  'kemenimipas', 'ditjenpas', 'guardandguide', 'infoimipas', 'imipasprima',
  'sobat pas', 'info pas', 'tim humas', 'humas', 'dalam rangka', 'semarak',
  'turut berpartisipasi', 'meriah', 'kekompakan', 'kebersamaan', 'antusias',
  'khidmat', 'penuh semangat', 'selamat datang', 'daily', 'sepekan',
  'pasti', 'berdampak', 'pemasyarakatanjateng', 'lombamusikpas',
]

/**
 * Penanda pelaku. Dipakai untuk memutuskan antara kategori 2 (perbuatan warga
 * binaan) dan kategori 3 (perbuatan petugas) ketika kata kuncinya beririsan,
 * misalnya "narkoba" yang muncul di keduanya.
 */
export const PENANDA_AKTOR = {
  petugas: [
    'oknum sipir', 'oknum petugas', 'oknum pegawai', 'sipir', 'petugas lapas',
    'petugas rutan', 'pegawai lapas', 'pegawai rutan', 'kalapas', 'karutan',
    'kepala lapas', 'kepala rutan', 'oknum lapas', 'oknum rutan',
    'penjaga tahanan', 'oknum kalapas', 'oknum karutan', 'staf lapas',
    'komandan jaga', 'regu pengamanan', 'oknum', 'kepala pengamanan',
    'kasi pengamanan', 'petugas pengawal', 'petugas jaga', 'kepala kpr',
    'kepala kesatuan pengamanan', 'kanwil', 'kakanwil', 'direktur jenderal',
  ],
  wbp: [
    'napi', 'narapidana', 'warga binaan', 'wbp', 'tahanan', 'penghuni lapas',
    'penghuni rutan', 'residivis', 'napiter', 'terpidana', 'balik jeruji',
    'jeruji besi', 'penghuni sel', 'warga binaan pemasyarakatan', 'bandar',
  ],
  eksternal: [
    'dari luar tembok', 'pengunjung', 'keluarga napi', 'keluarga warga binaan',
    'pihak ketiga', 'massa', 'kelompok bersenjata', 'orang tak dikenal',
    'masyarakat sekitar', 'kurir luar', 'lsm', 'wartawan', 'warganet',
  ],
}

/**
 * Frasa yang membalik makna. "Sipir gagalkan penyelundupan sabu" tidak boleh
 * dibaca sebagai pelanggaran integritas petugas, karena petugas justru
 * berperan menggagalkan.
 */
export const FRASA_PEMBALIK = [
  'digagalkan', 'menggagalkan', 'gagalkan', 'berhasil menggagalkan',
  'berhasil mengamankan', 'berhasil menggerebek', 'diamankan petugas',
  'ditemukan petugas', 'hasil razia', 'operasi bersama', 'sidak',
  'inspeksi mendadak', 'berhasil dicegah', 'dicegah petugas', 'nihil',
  'berhasil diringkus', 'berhasil ditangkap', 'kembali diamankan',
  'berhasil mengungkap', 'terbongkar', 'diungkap petugas',
]

/**
 * Frasa yang membatalkan peristiwa. "Bukan kabur, Rutan Muntok sebut yang
 * bersangkutan sedang menjalani asimilasi" bukan berita pelarian; ia berita
 * bantahan. Kemunculannya menarik berita ke subkategori 7.1.
 */
export const FRASA_BANTAHAN = [
  'bukan kabur', 'tidak kabur', 'membantah', 'dibantah', 'klarifikasi',
  'meluruskan', 'diluruskan', 'ternyata kasus lama', 'ternyata video lama',
  'tidak benar', 'isu tersebut tidak', 'terpatahkan', 'hoaks', 'hoax',
]

/**
 * Pemicu eskalasi ke urgensi tertinggi. Sesuai rumusan Dirpamintel, urgensi
 * "Kritis" hanya diberikan pada kejadian yang mengancam nyawa atau stabilitas
 * secara massal. Mesin aturan versi lama tidak pernah menghasilkan nilai ini
 * sama sekali.
 */
export const PEMICU_KRITIS = [
  'kerusuhan', 'pemberontakan', 'penyanderaan', 'sandera petugas',
  'membakar lapas', 'membakar rutan', 'lapas terbakar', 'rutan terbakar',
  'kebakaran lapas', 'kebakaran rutan', 'tewas', 'meninggal', 'jenazah',
  'gantung diri', 'bunuh diri', 'pelarian massal', 'napiter kabur',
  'baiat', 'pembaiatan', 'penyerangan lapas', 'penyerangan rutan',
  'evakuasi', 'penembakan', 'korban meninggal',
]

export const TINGKAT_URGENSI = ['Rendah', 'Sedang', 'Tinggi', 'Kritis']
export const PERINGKAT_URGENSI = { Rendah: 1, Sedang: 2, Tinggi: 3, Kritis: 4 }

export const NILAI_SENTIMEN = ['Positif', 'Netral', 'Negatif', 'Campuran', 'Tidak diketahui']

/** Semua subkategori dalam satu larik datar, masing-masing membawa induknya. */
export const SEMUA_SUBKATEGORI = KATEGORI.flatMap((k) =>
  k.subkategori.map((s) => ({
    ...s,
    pola: s.pola || [],
    kategoriKode: k.kode,
    kategoriNama: k.nama,
    sifat: k.sifat,
    warna: k.warna,
  })),
)

export function cariKategori(nama) {
  if (nama === KATEGORI_LUAR_LINGKUP.nama) return KATEGORI_LUAR_LINGKUP
  return KATEGORI.find((k) => k.nama === nama) || KATEGORI_LAINNYA
}

export function cariSubkategori(kode) {
  return (
    SEMUA_SUBKATEGORI.find((s) => s.kode === kode) ||
    KATEGORI_LUAR_LINGKUP.subkategori.find((s) => s.kode === kode) ||
    null
  )
}

/** Daftar nama kategori untuk komponen tapis. */
export function daftarNamaKategori() {
  return [...KATEGORI.map((k) => k.nama), KATEGORI_LAINNYA.nama, KATEGORI_LUAR_LINGKUP.nama]
}

/** Kategori yang tidak ikut dihitung sebagai publikasi terpantau. */
export const KATEGORI_TAK_DIHITUNG = new Set([KATEGORI_LUAR_LINGKUP.nama])

/**
 * Tema laporan — proyeksi taksonomi intelijen ke bahasa laporan pimpinan.
 *
 * KENAPA LAPISAN INI ADA, DAN KENAPA IA BUKAN TAKSONOMI KEDUA
 *
 * Taksonomi di atas disusun untuk pekerjaan intelijen: ia bertanya "ancaman
 * apa ini, siapa pelakunya, seberapa mendesak". Itu pertanyaan yang benar untuk
 * halaman Kanal Negatif, Kasus, dan Risiko — dan sembilan kategorinya memang
 * dipakai untuk itu setiap hari.
 *
 * Laporan berkala menjawab pertanyaan yang lain: "sepekan ini Pemasyarakatan
 * ramai soal apa". Pertanyaan itu tidak terjawab oleh kategori ancaman, sebab
 * mayoritas pemberitaan justru bukan ancaman — dan bila seluruhnya dijejalkan
 * ke satu keranjang "Narasi Positif", grafiknya menjadi satu batang raksasa
 * yang tidak memberi tahu apa pun.
 *
 * Maka tema di bawah ini BUKAN daftar kategori kedua yang harus dijaga tetap
 * sama. Ia peta: satu arah, dari subkategori ke tema, tanpa kata kunci sendiri
 * dan tanpa mesin klasifikasi sendiri. Sebuah berita tidak pernah "diberi
 * tema"; temanya dibaca dari subkategori yang sudah ditetapkan mesin. Dengan
 * begitu tidak mungkin ada berita yang bertema A tetapi berkategori B —
 * kelas kekeliruan yang sama yang dihapus lib/hitung.js untuk angka.
 *
 * Urutan larik ini adalah urutan tampil pada laporan bila jumlahnya sama.
 * Warna mengikuti palet laporan, bukan palet aplikasi: laporan dicetak dan
 * dibagikan di luar aplikasi, sehingga ia tidak boleh ikut berubah ketika
 * seseorang menukar tema gelap.
 */
export const TEMA_LAPORAN = [
  {
    kode: 'pembinaan',
    nama: 'Pembinaan, Pendidikan & Keagamaan',
    warna: '#1f9d55',
    ikon: 'pembinaan',
    subkategori: ['8.2'],
    ringkasBaku: [
      'Kegiatan keagamaan, pembinaan rohani, dan kajian',
      'Pendidikan formal, kesetaraan, dan pelatihan keterampilan',
    ],
  },
  {
    kode: 'keamanan',
    nama: 'Keamanan & Ketertiban',
    warna: '#0f6b5c',
    ikon: 'perisai',
    subkategori: ['1.2', '1.3', '2.1', '2.2', '2.3', '4.3', '5.1', '5.2', '6.1', '6.2', '8.5'],
    ringkasBaku: [
      'Razia, penggeledahan, dan sidak blok hunian',
      'Penguatan pengamanan, deteksi dini, sinergi TNI/Polri',
    ],
  },
  {
    kode: 'kesehatan',
    nama: 'Kesehatan',
    warna: '#1d6fd0',
    ikon: 'medis',
    subkategori: ['8.7'],
    ringkasBaku: [
      'Layanan kesehatan dan rujukan warga binaan',
      'Jaminan kesehatan (BPJS) dan edukasi kesehatan',
    ],
  },
  {
    kode: 'tata-kelola',
    nama: 'Tata Kelola, Integritas & Pungli',
    warna: '#7c4dbd',
    ikon: 'dokumen',
    subkategori: ['3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '7.1'],
    ringkasBaku: [
      'Bebas pungli, penguatan integritas, evaluasi layanan',
      'Pemeriksaan dugaan penyimpangan dan pelanggaran etik',
    ],
  },
  {
    kode: 'pangan',
    nama: 'Ketahanan Pangan & Pemberdayaan',
    warna: '#e2711d',
    ikon: 'tanaman',
    subkategori: ['8.6'],
    ringkasBaku: [
      'Panen sayur, budidaya hortikultura, peternakan',
      'Kerja sama pelatihan dan kemandirian ekonomi',
    ],
  },
  {
    kode: 'hak-layanan',
    nama: 'Hak, Layanan Dasar & Integrasi',
    warna: '#d4a017',
    ikon: 'timbangan',
    subkategori: ['8.1', '8.3', '4.1', '7.2'],
    ringkasBaku: [
      'Hak integrasi: remisi, asimilasi, pembebasan bersyarat',
      'Layanan hukum, perlengkapan dasar, dan bakti sosial',
    ],
  },
  {
    kode: 'kapasitas',
    nama: 'Over Kapasitas, Overstay, Pelarian',
    warna: '#c62828',
    ikon: 'awas',
    subkategori: ['1.1', '4.2'],
    ringkasBaku: [
      'Over kapasitas hunian dan overstay tahanan',
      'Pelarian warga binaan dan upaya penindakannya',
    ],
  },
  {
    kode: 'kelembagaan',
    nama: 'Kelembagaan & Seremonial',
    warna: '#5a6b7d',
    ikon: 'lembaga',
    subkategori: ['8.4'],
    ringkasBaku: [
      'Upacara, pelantikan, dan rapat koordinasi',
      'Peringatan hari besar, lomba, dan kunjungan kerja',
    ],
  },
]

/**
 * Peta cepat kode subkategori ke tema. Dibangun sekali saat modul dimuat,
 * sebab laporan mingguan memanggilnya sekali per berita — ratusan kali — dan
 * pencarian linier di dalam larik tema akan terasa pada berkas besar.
 */
const TEMA_MENURUT_SUBKATEGORI = new Map()
for (const t of TEMA_LAPORAN) {
  for (const kode of t.subkategori) TEMA_MENURUT_SUBKATEGORI.set(kode, t)
}

/**
 * Tema laporan untuk satu berita.
 *
 * Dua hal sengaja mengembalikan null, bukan sebuah tema cadangan. Berita di
 * luar lingkup memang tidak boleh muncul pada laporan sama sekali; berita yang
 * belum dikelompokkan mesin (kategori "Lainnya") juga tidak, sebab menempatkan
 * yang belum dinilai ke dalam sebuah tema berarti melaporkannya sebagai sudah
 * dinilai. Keduanya dihitung terpisah oleh penyusun laporan.
 */
export function temaLaporan(berita) {
  const kode = String(berita?.subkategori_kode || '').trim()
  if (kode) return TEMA_MENURUT_SUBKATEGORI.get(kode) || null
  // Baris lama menyimpan nama subkategori tanpa kodenya. Dicocokkan lewat nama
  // supaya arsip sebelum 4 September 2026 tetap masuk laporan.
  const nama = String(berita?.subkategori || '').trim()
  if (!nama) return null
  const sub = SEMUA_SUBKATEGORI.find((s) => s.nama === nama)
  return sub ? TEMA_MENURUT_SUBKATEGORI.get(sub.kode) || null : null
}
