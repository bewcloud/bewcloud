import { assertEquals, assertMatch } from '@std/assert';

import { generateVCard, getIdFromVCard, parseVCard, splitTextIntoVCards, updateVCard } from './contacts.ts';

Deno.test('that getIdFromVCard works', () => {
  const tests: { input: string; expected?: string; shouldBeUUID?: boolean }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:12345-abcde-67890
FN:John Doe
END:VCARD`,
      expected: '12345-abcde-67890',
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
FN:Jane Smith
UID:jane-smith-uuid
EMAIL:jane@example.com
END:VCARD`,
      expected: 'jane-smith-uuid',
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
FN:No UID Contact
EMAIL:nouid@example.com
END:VCARD`,
      shouldBeUUID: true,
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:   spaced-uid   
FN:Spaced UID
END:VCARD`,
      expected: 'spaced-uid',
    },
  ];

  for (const test of tests) {
    const output = getIdFromVCard(test.input);
    if (test.expected) {
      assertEquals(output, test.expected);
    } else if (test.shouldBeUUID) {
      // Check that it's a valid UUID format
      assertMatch(output, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    }
  }
});

Deno.test('that splitTextIntoVCards works', () => {
  const tests: { input: string; expected: string[] }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:1
FN:John Doe
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:2
FN:Jane Smith
END:VCARD`,
      expected: [
        `BEGIN:VCARD
VERSION:4.0
UID:1
FN:John Doe
END:VCARD`,
        `BEGIN:VCARD
VERSION:4.0
UID:2
FN:Jane Smith
END:VCARD`,
      ],
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
END:VCARD`,
      expected: [
        `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
END:VCARD`,
      ],
    },
    {
      input: '',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
FN:Incomplete Contact`,
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
PHOTO;VALUE=URI:data:image/jpeg;base64\,/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUN
 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
 //9k=
END:VCARD`,
      expected: [
        `BEGIN:VCARD
VERSION:3.0
FN:Single Contact
EMAIL:single@example.com
PHOTO;VALUE=URI:data:image/jpeg;base64\,/9j/4AAQSkZJRgABAQAAAQABAAD/4gIoSUN
 DX1BST0ZJTEUAAQEAAAIYAAAAAAQwAABtbnRyUkdCIFhZWiAAAAAAAAAAAAAAAABhY3NwAAAAA
 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAA
 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAAHRyWFlaAAABZAAAA
 BRnWFlaAAABeAAAABRiWFlaAAABjAAAABRyVFJDAAABoAAAAChnVFJDAAABoAAAAChiVFJDAAA
 BoAAAACh3dHB0AAAByAAAABRjcHJ0AAAB3AAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAFgAA
 AAcAHMAUgBHAEIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
 AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFhZWiAAAAAAAABvogAAOPUAAAOQW
 FlaIAAAAAAAAGKZAAC3hQAAGNpYWVogAAAAAAAAJKAAAA+EAAC2z3BhcmEAAAAAAAQAAAACZmY
 AAPKnAAANWQAAE9AAAApbAAAAAAAAAABYWVogAAAAAAAA9tYAAQAAAADTLW1sdWMAAAAAAAAAA
 QAAAAxlblVTAAAAIAAAABwARwBvAG8AZwBsAGUAIABJAG4AYwAuACAAMgAwADEANv/bAEMAAQE
 BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA
 QEBAQEBAf/bAEMBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE
 BAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAGAAYAMBIgACEQEDEQH/xAAeAAABBAMBAQEAAAAAA
 AAAAAAGBQcJCgAECAMBAv/EADQQAAIBAwMDAwIFAwMFAAAAAAECAwQFEQYSIQAHMRMiQQgUCRU
 yUVIjYXEWQsEkJTM0Y//EAB4BAAEDBQEBAAAAAAAAAAAAAAABAggDBQYHCgQJ/8QAMhEAAgEDA
 wMCBQEIAwAAAAAAAQIDBAURAAYhBxIxE0EIFFFhcSIJFjKBkaGx8TNywf/aAAwDAQACEQMRAD8
 Agv6zrOvWCCSplSGIAu5wMkgAZAZmIBIVcjJAJ5AALEA/S9mCjJ1eNeagsQoGSSAAPJJOAB/k9
 LlJZJZTuqWMKYfCxgSSblLKFIyAoJAJYb/bk4zx0Q263Q0ibVBMrhBJK2C5cjlF8BUJJIRcsQV
 DFsA9LsVHn3Y8+0I+ckDJyCynBGT/ACIAwAByPOZnJwgIPOMecnHP2II4I8aNIEVkokH/AK6yB
 gATK3qZB8na+VUkYztAPHHPWpqSkSLTF/jhjRY47HdW2KoACpb6nBO0KfaMhTk7STjAJPRytIu
 7lAVY5OTnb84VSCQP3IYHH+Oun+3f0A/WP9Snb693rsX2B1ZrSy3Kx1cdmv8AXXLS+gNM3lK6u
 uul5pdP6q7i3zS2ndQm0XS3XSG701ludZUW17dPDWJT1DU0NRjW76unodt3mStqoaZZbdVxqJp
 VRppGp3CRIGP63fwqLl2zwDpkv8Dc44/r9tcLaJpUk0fZRIqur0jbk+OKqY7fd8qy8nIzg4LKc
 sty2SjkyxpxHgHmNthxjg7VO0keRkck85HHXZ+ufw9/rL+mntdatU99exl90fZLbTLBfbzbL/o
 zXdl08zXWntNFJfrtoDU2p6PT1Lcqy4Wumt017noIqutuMFuppJ6zfEOY5KPDAtGeR5fcG9pPA
 B5I5GcMPOCP3Nl1cFZtmzSUNVBUIltoophG4f05Upou6KQLyki5wyt2kZ50R/8AHH/0X/A019T
 Y5VO+lf1I9pYJJlZSQAVCMFCSbvccYTHtHuznpDZWRijqVZSQysCCCPgg8j/nyOOnalos5Cj/A
 HDIU4cL597YJYMPIIUnPk4J6Qa+3Q1cXv4dGOydQNyDklWB52HIypOCQGUrkDrKVkIIWQBT7cE
 A+PfJ4P5AHtp+gHrOveop5aWZoZlCsAGUhlYPGSQsikE+1irAZweCCAQQPDqro19VWZlVQWZmC
 qqglmZiFVVAySxJAAAJJIAGTye2+3RU0SAJmfAMzjbJmQAn+mdmQqkYQbirMN3G4jpAsNLumar
 dQUiIji8/+VsB2OCP0RuNo59zhuCo6PKOME88kneigYBywYgktwRn+yktnwGx5pSWcIMewGOeS
 QOfcfgZ/vo1sU9LgAknccH9K54AGGyo2nI854zwQAAC212OprWyUeGnXOZmThmO7CRglQxBB3Y
 YAAHJycH82S1tWzpvj308ZV5gGClk3lQg96sP/oVZW9MOY8ybFLvUlEohUhVG0DaoiCRoARtPp
 xhcEgDA24PLHLAnqsi9owBgjBY4znOMgH6Z/pn8aNaGn9P0lNcra8VkS+mK4UjNaZ1q5fzcipj
 b8sxQS01wH32TSkW6qpq7bKq01TFOI5EtfdsLrp6Htr2/gqPqn1z2xmh0Npail7cW/T/cuut2g
 npbHQ0zaOttXp+7U1krKLTLRNZ6C5WakpLfV01IlVQRQQVCxisFZtO1t8uNus9soa663a819Ha
 LZbLdTVNZcLjcrpVR0VFb6Cioo5ausrK2pnp6akp6SKSonnkSKFGkZVNsm30Gqu2/ajt7aIu1H
 aruNU6I0ZpPS2u9WV3bptR3O46htenkgrtY3uumnNc0V+qLVdLhcLxcoY1jqWElzq1qq+MSQY+
 MnrvsTpC2zKPdFRXT1t6W7zU9ss9MtfWimoUpXnqqimMo9KnRHJWVkA/Q57sIcX2ybIvG8ZSls
 lo6ZYHjiee4VXydM0sxxFF6rYRpHYdqoTks6gfxccv/AFBt28u9r/KtQfX53Jt9k1DYNTWO66b
 fQPeq8WbXFruNLRW662a72z/VMNrmoFoqwUdZTXCikgqqW7z7xOkciR1i7np+mqnlMlCKSRnkY
 xwIY/t23EtEVdnkKoxKlZ2klwuGcuC3VxqwW2j7hRw6l1x9P3Y2jtl2tVytmnb7W9pbSa+UU/2
 M89ZaYbuKhaq2U6Xg5ngWCnkuEoSGr+6pahYKl95stbbbldKC5UNZbrpbK+roLrbbjS1VBcaG5
 0c709dRV1DWR09VR1dLURvBV0tRFFNTTxyxSxpIjID4NOvGxOr7b0oNrz3GCssiWWont94pUoK
 pqe4R1LwVVLB6ndNTMkYLS9jdoki/ViRcsvmyLxs2dUuUlFUR1DzQrPb6k1cCTU5RZonl5iWRG
 btKg9wZWUjKkDnW6WKeiYMoM0LHb6qJhVOFUGTBYoS2RgtsyQAxJAAjVUx5O3woDR7Bg5I5OSB
 wP3GMAnPXRNZRxSLIGVSrgl1wPcpVgeSDy3wMjg8lTwWkv9s+znyCvoTA+ioJLhVCiQOTg5R22
 j9W5Cjb925VnSyhgQQP5/2OefrkYz9casumsuFvWtidPYJjzA7KishBB9NnPIDYIcFsDduOSoI
 AWRkZkdSrIxRlOCVZTtZSQSCQQeQSDjgkc9O5Vx7SQAcsDkAj2+dpyT5JBHGQCATwSegLUFP6c
 kU4G0OxWVfOJGVBEcgkZdEZWUcAxB9xLtilGSpMbHkDIx4xxnHufP3x40aXLLD6dFTB1AZ4zK4
 xn3SkuAcj9SIyocjIZfA8AtpVYIh8gqWyedueVGM5IB3Dj5Hx0g0ibI1Q5IjX01JzwsYCRhc5I
 CoAFGeFAA46LrbGrzU0YQMJJYowhG5T6m7jb5I/sPHx8DpqBTIcDhRkfnjkke/njx9vOgfnP3/
 1p1LBQiCkhiUMpdFlYNw5aRRJsJBwrKWMYbauBGSwUtgO1o/TF31XqCw6VsVG9w1BqW72ywWSj
 Wppqf727Xqvgt1spPuqySnpKYVFXVQwNVVlTT0dOjGSpnhhjeVQG3qDwdwdioBbGU9rMwwFXLE
 EZyByCAFUnqY78KXtpR3fuB3A7n1pikm0FY7fp+zU1bY6apgev1pJWmsulqvlTUGW33S0WuyT2
 uqpqCiknqLVqqdKm40VLM1DeNO/EP1dpOhnR7evUuphSqm2/bCbbRuxCVd2rZYqK2QP24f0nra
 iL1u39SxBnGMHV727Z3v14obWhKColAkdRykK5eVh7ZCBu3Pvga7z+lj6Lu3/AGBtVm1RfqC06
 q7vLBPU1usqiknePTslxo0pKyz6NhucaNaqGCBqqk/Po7fbNUXulr7gl2kordWxaYtMk2lLm9u
 7Zdy71RkVEcktjspgKs255JlppTuDhkIgvsTxyyRvtZX3II29Tppnp7hebhBZLVSz1lXUMgWng
 RpJHbcCAcAiOGAASzSsyxxLmSZ0RCenko9Eayou1d905+SO12vGrqOd6YVltLRUNOtqkFU8pq/
 t5Y/Xt2xdsxkjExm2AwS7OVuv6jdQ+re99y9Rd63G67gu9XaL6Keok9eWnpZKuklp4LfbowGip
 oIRUYhpYFVVQZ7ct3akzd7dY7FabTZKeSjpBJdrU80DyRpI1NHUxyy1M+SHOViHdIScZOW+mtf
 6mCfs/wBv7xWPKkyXq92+IyEOqx1NXdZWAOA7gR2yJU9MMyiN0K7UZki6+sT6StD95rZW6stFF
 btOdzZaWNaDVcEU0cF3rbdF/wBHb9U0tvT/ALrRVlvje2m7Gmr9QWaOmtU9tjuVBbKjT9ylPr9
 Ia1re0ti02dPyrdLPqWWr+wers7zvQTQ3VjUxymu+2gIqbiUKioFSyLIQphnKnmTXVDdLJTx2i
 70dTQzpcFMcNTHJCcpDWoXhDoEqKZ9knpzwSNDIRviaRSWVaHqL1D6Sb02r1E2TcLrt670NlsK
 zVUImip6p6SmhgqLfcYyBDVQTfL9k1NOrKy89uQCPdta22C/wXGxVr0dfHLfbmIaUyJJJ8pNOZ
 I6mnwe9Cnq+osinPcPOqkurNN3DTN9vem7zTvb73YLrX2m6UMrQStTV9tqZaSrp/VpJqiklEc0
 MipPS1NTSToFmpqieB45Xau+UEVTBJGi7nGXiAJK7gjEhfP6vchC5YBjhXPtaW38Rvt7QW3VWh
 u5FrpDT1OqbdX6f1HLFTRJRy1+nZKSe0XKqlVA8t4uFsus9rZ5nZntumrdDCFFLITFVW+mXGxd
 oV2GCBnOGPGOADn4x88fv1P8Aw6dX6brr0c2V1MghWlnv9tIudIhytJd6CaSgucKAlmEIrKeZo
 O89xgaNjnOdRl3nt19q7lutjZu9aOcejIfL08qLLAzcD9RidQ30YEe2NMBWIwDqBnA2qw9odt5
 BPJPHC/OPK7iQcCN5phNQ1G4bXSMzccNvpwJQoIySG2NGR/Bm8jgnlxj2y1C4YCN5Au7PIB2hg
 SeRuBOT5cFv1EnoSq9rQkSL6iuGRl85Eg2NxtfdlWIxtbOfB+dzy5Dr2nDHjPHuRjPn/Hj86xf
 XykYugf8AluYfHtJBXH7jZgg5OfIJznowtb+nU0sgz/TnicYGTmMOcAEHPK48HPTfWWRpKOkJf
 lI2jYDADGItGCw5O5lVXIyME55HkxpnbahIDZG5gTjLDHAz8M24E4I+f8qgCyupIGVBH3zjj8n
 P40af23kAI7HnCyYyDkBApGV9h5PkNg5BVsdWFPwoNR22r7L9wNNxyKbza+5U+oa6A0zrstmpN
 K6Xt9pl+5aERzhqjS93Q06VMrUrJ6jwwrVxST107HWLPTQyK24oVidnyOY41XfgnJDKUcc7sNh
 jkE9SUfh4d+rV2Z7ztbdX3w2jQ3ca1HT17nlECW23X+glkrtIagukiW2su8kVM8l60zBT0tZR2
 qKTV35xfc01nhrLdDz49unt56k/DH1Bs234Jqy7W2notw01DAjSS1iWathrKuGONP1SS/JpUND
 GoLPKqqqknWZ9PrhBbN1WyepcLC7SU7OxwFaaMpGzfQep2gnwAxJ45FnDQV/tdi1Hd47vPLaxe
 rVPbaO/06RPLaHmCbJVjmgqIgXdY2SaSnmhilpofuUNM8zBT1jrH8q0/ZdJ2HU9wu9ytlbUVF5
 1NSXCsiqJJsSyU9DLWmR6mvVkrzg/e1EdIlDTwO7ykCJrah6S6QpPRVFNUPGGVjDPE5XBLenMo
 YsrqxKqGCEEncCuCqBUTRUgY1MscAU4JkdV5+AMkbi3+0LkseFyeuWOHdV0oLS9kjT5do/WgE6
 tNDUwpJLHJLEVV1Qv6kePUZS6rlBgeJXfulbrjdYrtUGR2BiZ6KRI3illhjMUT/qQyBO2Q90QP
 YzgMy8EF7tIaxNz0/f9K33VVystwuc8VXadT1NdWTPBURimeSkaqDevRxmK3bS5rKaKaKrqaaN
 hPOqytJ3w1haNS6is1BZaz83isFlit1dfpFKT3SvikmEqTKYoVY0ZEkgnhiigmnuNT6SvCkLkA
 umqIAhgtr+pIx2NOyyIiBgQxgzsLzA42MQYgdrFZhuj6EY49g3yHL+5mdmyeSSzOeAWY5Z2Ock
 5z+yz7rudfaUskqCoaQRQCdjNLUyqkxkiiAaRo+8yOR3qgkcYXOBrI7FsOgt18O4gZaZY/Vlho
 xHFHCks0KwTSNhBIE9NMhCQgcswHOo9/wAR692+m7U6JsEsyrdLn3BhvVHTmJmeW32HTt9ornK
 sxi9JPQn1Ha0MTTxyymoVoopVhleCECsCephGJ9zOQc58lf4gcZHz8n+3Xfn1296KTuN3M/0tZ
 fQqrD2xku+nqauWJ1mqr/VvQprGanmeKCX7OCvtdDY0hmjqaeSq07UXO11ElDdRJUx0X24mmp5
 5FK7vTmjpiASWlcsFkUZ3ZjQvMYwQxWMqCGYHrqX+ATp3e+m3ww9P7RuKnmpLtcoq/cNRRTqyy
 UkN4rZqyihdGw0b/JPTvJGQGjkkZSAQdRC6tXikve/L1V0TiWnR4aRZVIKu1LCkUjKRwVMgYKR
 wVAPvy1dylEk1Q2ch2fYQMjDD1R/fGHzz/jPjoRqzsi3eQmXI5ywTDEfHJA45HI8jz0Q1MnskL
 HkBseBngEAELgFTgDHOQAP26DrzUCO3zbsuzxCLySxaoAiDkLjhd5kbPtKo3gciYzgmVAB/Dg/
 yByfxj6eda40g2CrKTvTsVCyBpIyWI/rABXXGCp3xjdkkYMe0D3ZB7Sy843FeOCeFDDBLYOAwO
 QQcYOD4BPTSxyPE6SRsUdGDowGSrA5B5/b9jwfBGOjm218VXCZAwSTeqSx7+UcYOVJJbaMkqcK
 G5VgcYCyr2kSDypXj24PH49ho07FhujUcwjbmGYoJDlfYA2C/j4GcknhCcAnGHaoK5WAlilBbY
 FL5O10YBSRyATyyk4BwGVuc454pajOASN2CynP6hwc5Jzkk5AGMDgfBJZa77UUeIpC8tKCW2ZC
 srHdu2vhmGcggbWRsk4DHPT8JKhV1VlkVgyNhlZSMMrA8EYOGBGMHB0oJBBBwQQQR5BHIP8tTZ
 /T3+IALNQ2zSHfJbjdaWmBpIe5dH612vK05kt1NRDWNrLvWXYUdKtwqbpqi1SVmoa/7alWp0/q
 C9V1wvMkj2nu93ZrV35VDp7uhoG6VV6p6eptlpi1RZor3UR1USzwo2n6qrgvdJV+m4M1vrLfTX
 Ckk3wVdLBURyRJVrt96papSsVQpkVgPtjKnqckjGN2WOQchWYqB7iOl5a9igRjIAvhUGMcAcs5
 G48eVJ/ck5BPzT64/swui3VbcNZurbNyunTa8XSWSpuVPZ4KessdTUyOXlqY7XOYjSyyux71pq
 iKn8kQq5J1una3XLcu3KaKgraemvVPCqpA1SWirI41wAnzC9wdRjAMkbPzgvwNWftTd5O0mjZr
 jR6n7kaJs9xtNFLcLhZarUdrfUEVJFRi4O8WnIKma/Vsr0TJU01HQ26qra1JIVoqaoknhR42fq
 H/EDa7UN20X2Rp6q30Vaktvr+5Fwaott8ekc18NU+iLVGxqbV95CLc1FqK8mlvsENVcUo7Fp+8
 UVuvHUU/3rYIRpBuOT6mAPAzjYSQ2QMZGDyTyc9IdbfaanAWaYDczK0ceGlC5BGcHgFn5ZnUkE
 YJ8dJ0O/Zg9FulO4aLdO5rnc+pF4tk0VVbaa7wU9DZKWphdXjqXtkBlaqkjdQUWpqZIAeTCSAd
 VN09dNz7go5bfRRU9kpp1ZJ3p2aWrkjYAMgnYKI0POSkYf2DedEFfcWw8ksmXYOZJC2CmQSZZi
 eFwDuO7Yo93IGT00d+uv3snpICKeGTdHkAEnYyuzAqGy5fK7j7ERgoHqSZy636arZ4ot0dKH/p
 gMyu6gkgysGf1A3BMRIiBUfr4ZRKrqyCQGy+NzFgDjOefOc+OMEYPjr6WgJEiqqqkaKFVVAVVV
 RhVVRgAAAAADAHA1pIkkkkkknJJ5JJ8kn3J1r1T8Mp5IUEktgE7jyFwVOSDn9uMeBhv7/Vb5o6
 dDj0xulIPt3spREB2jlY2fOGHtlwyHKkLlxraelR5GkHqnKwo0gLzTDcTsT1VLqOGkwMRpltvI
 VgWR2lkeRmZ2d2YswAZixJyQvtX9tqgKvCqAoUdNjBJMh8tkAYHjgA/Y8e3/uk1+OtilqpqSUS
 wthtjKytuaM7hjLIGTcVBJXJGDzkYA61+s6q6NH1BcIqyPIbMgjQyQt5jfBDbfbg5IYhxkeCQu
 cdECVbcchzkgNnJXgnJUsuT8cEHDZ5GSWjjd4ZBLExjkByHQlT/AHBx+oH5DZBHBBBPRBSX9oF
 C1ETOAeHjJL4bcTlCuw8/IZAv6doGOqTRkZaPhgT3ecEHnABzz9hwftg6NOXHWAMArqDyNoDFm
 wOTkHGP8qQcHz0o090qYC3pTzRBsZ2ylFOOB7YyjZwTjd4BIIyegKnvFDOHmWVV9IKC02IGTcx
 UAersJBJPK5U889boq43VXXMivkq6HerYxkhkyp8j55zz0nqSg8pkjHIBxnA5zyM58+2dGi+ou
 NRPkzVEs4IA9OSQuuMEcCUsMckkE87mx560ZKtSeZACFJIfIPP8c4x48AHPAwOOh01sS53HYAM
 kudi4zgZLYHJ8f8daFRdqFFLtPDKwQE7NkzsfG4KhYkMSMLkY/lg5Cd8rHAQAnjnIA58+Qv8Av
 RohkqssxVkBwckggkcbdw35Y48EhcDPHu6HK+4xUdOxILyEsY6WN1WeXBK5DOyxqvhgzhUBAXc
 zYyh1N+dwVp4VQspUzOoEm3AACxrlFHAB3tIMAABSQQgu8krtJK7SSMTlmJLEE8D+wUYUfsAAM
 AAByoxyZSWJxxnjj6/jngHH50a96qrmq3EkxHtACogKxphdpKKSxBbksSzMSTlsYA1us6zqro1
 //9k=
END:VCARD`,
      ],
    },
  ];

  for (const test of tests) {
    const output = splitTextIntoVCards(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that generateVCard works', () => {
  const tests: { input: { contactId: string; firstName: string; lastName?: string }; expected: string }[] = [
    {
      input: { contactId: 'test-123', firstName: 'John', lastName: 'Doe' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:Doe;John;
FN:John Doe
UID:test-123
END:VCARD`,
    },
    {
      input: { contactId: 'single-name', firstName: 'Madonna' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:;Madonna;
FN:Madonna 
UID:single-name
END:VCARD`,
    },
    {
      input: { contactId: 'special-chars', firstName: 'John,Test', lastName: 'Doe\nSmith' },
      expected: `BEGIN:VCARD
VERSION:4.0
N:Doe\\nSmith;John\\,Test;
FN:John\\,Test Doe\\nSmith
UID:special-chars
END:VCARD`,
    },
  ];

  for (const test of tests) {
    const output = generateVCard(test.input.contactId, test.input.firstName, test.input.lastName);
    assertEquals(output, test.expected);
  }
});

Deno.test('that updateVCard works', () => {
  const tests: {
    input: {
      vCard: string;
      updates: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phone?: string;
        notes?: string;
      };
    };
    expected: string;
  }[] = [
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { firstName: 'Jane', lastName: 'Smith' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Smith;Jane;
FN:Jane Smith
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-456
N:Doe;John;
FN:John Doe
EMAIL:old@example.com
TEL:+1234567890
END:VCARD`,
        updates: { email: 'new@example.com', phone: '+9876543210' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-456
N:Doe;John;
FN:John Doe
EMAIL:new@example.com
TEL:+9876543210
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-789
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { email: 'added@example.com', phone: '+1111111111', notes: 'Test notes' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-789
N:Doe;John;
FN:John Doe
EMAIL;TYPE=HOME:added@example.com
TEL;TYPE=HOME:+1111111111
NOTE:Test notes
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-special
N:Doe;John;
FN:John Doe
NOTE:Old notes
END:VCARD`,
        updates: { notes: 'New notes\nwith newlines, and commas' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-special
N:Doe;John;
FN:John Doe
NOTE:New notes\\nwith newlines\\, and commas
END:VCARD`,
    },
    {
      input: {
        vCard: `BEGIN:VCARD
VERSION:4.0
UID:test-carriage
N:Doe;John;
FN:John Doe
END:VCARD`,
        updates: { notes: 'Notes with\r\ncarriage returns' },
      },
      expected: `BEGIN:VCARD
VERSION:4.0
UID:test-carriage
N:Doe;John;
FN:John Doe
NOTE:Notes with\\ncarriage returns
END:VCARD`,
    },
  ];

  for (const test of tests) {
    const output = updateVCard(test.input.vCard, test.input.updates);
    assertEquals(output, test.expected);
  }
});

Deno.test('that parseVCard works', () => {
  const tests: {
    input: string;
    expected: Array<{
      uid?: string;
      firstName?: string;
      lastName?: string;
      middleNames?: string[];
      title?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }>;
  }[] = [
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:test-123
N:Doe;John;Middle;Jr
FN:John Middle Doe Jr
EMAIL;TYPE=HOME:john@example.com
TEL;TYPE=HOME:+1234567890
NOTE:Test contact notes
END:VCARD`,
      expected: [{
        uid: 'test-123',
        firstName: 'John',
        lastName: 'Doe',
        middleNames: ['Middle'],
        title: 'Jr',
        email: 'john@example.com',
        phone: '+1234567890',
        notes: 'Test contact notes',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:3.0
UID:test-456
N:Smith;Jane;;
FN:Jane Smith
EMAIL:jane@example.com
TEL:+9876543210
END:VCARD`,
      expected: [{
        uid: 'test-456',
        firstName: 'Jane',
        lastName: 'Smith',
        middleNames: [],
        title: '',
        email: 'jane@example.com',
        phone: '+9876543210',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:multi-1
N:Doe;John;
FN:John Doe
END:VCARD
BEGIN:VCARD
VERSION:4.0
UID:multi-2
N:Smith;Jane;
FN:Jane Smith
EMAIL;PREF=1:jane@example.com
END:VCARD`,
      expected: [
        {
          uid: 'multi-1',
          firstName: 'John',
          lastName: 'Doe',
          middleNames: [],
          title: '',
        },
        {
          uid: 'multi-2',
          firstName: 'Jane',
          lastName: 'Smith',
          middleNames: [],
          title: '',
          email: 'jane@example.com',
        },
      ],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:escaped-contact
N:Test;Contact;
FN:Contact Test
NOTE:Notes with\\nescaped newlines\\, and commas
END:VCARD`,
      expected: [{
        uid: 'escaped-contact',
        firstName: 'Contact',
        lastName: 'Test',
        middleNames: [],
        title: '',
        notes: 'Notes with\nescaped newlines, and commas',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:2.1
UID:version-21
N:Old;Format;
FN:Format Old
EMAIL:old@example.com
TEL:+1111111111
END:VCARD`,
      expected: [{
        uid: 'version-21',
        firstName: 'Format',
        lastName: 'Old',
        middleNames: [],
        title: '',
        email: 'old@example.com',
        phone: '+1111111111',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:email-variations
N:Test;Email;
FN:Email Test
EMAIL:direct@example.com
EMAIL;TYPE=WORK:work@example.com
TEL:+1234567890
TEL;TYPE=WORK:+9876543210
END:VCARD`,
      expected: [{
        uid: 'email-variations',
        firstName: 'Email',
        lastName: 'Test',
        middleNames: [],
        title: '',
        email: 'direct@example.com', // Only first email is captured
        phone: '+1234567890', // Only first phone is captured
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:5.0
UID:invalid-version
N:Invalid;Version;
FN:Version Invalid
END:VCARD`,
      expected: [{
        uid: 'invalid-version',
        firstName: 'Version',
        lastName: 'Invalid',
        middleNames: [],
        title: '',
      }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:no-first-name
N:LastOnly;;
FN:LastOnly
END:VCARD`,
      expected: [{ uid: 'no-first-name' }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:empty-uid
N:Test;Empty;
FN:Empty Test
END:VCARD`,
      expected: [{
        firstName: 'Empty',
        lastName: 'Test',
        middleNames: [],
        title: '',
        uid: 'empty-uid',
      }],
    },
  ];

  for (const test of tests) {
    const output = parseVCard(test.input);
    assertEquals(output, test.expected);
  }
});

Deno.test('that parseVCard handles edge cases', () => {
  const edgeCases: { input: string; description: string; expected: any[] }[] = [
    {
      input: '',
      description: 'empty string',
      expected: [],
    },
    {
      input: 'Not a vCard at all',
      description: 'invalid format',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:incomplete`,
      description: 'incomplete vCard without END',
      expected: [],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:missing-required
FN:Missing Required Fields
END:VCARD`,
      description: 'vCard without N field',
      expected: [{ uid: 'missing-required' }],
    },
    {
      input: `BEGIN:VCARD
VERSION:4.0
UID:empty-fields
N:;;;
FN:Empty Fields
EMAIL:
TEL:
NOTE:
END:VCARD`,
      description: 'vCard with empty field values',
      expected: [{ uid: 'empty-fields', notes: '' }],
    },
  ];

  for (const test of edgeCases) {
    const output = parseVCard(test.input);
    assertEquals(output, test.expected, `Failed for: ${test.description}`);
  }
});
