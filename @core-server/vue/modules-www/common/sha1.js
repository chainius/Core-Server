function SHA1(a) {
    function b(a,b) {
        return a<<b|a>>>32-b
    }function d(a) {
        var c,d,b="";for(c=7;c>=0;c--)
            d=a>>>4*c&15,b+=d.toString(16);return b
    }function e(a) {
        a=a.replace(/\r\n/g,"\n");for(var b="",c=0;c<a.length;c++) {
            var d=a.charCodeAt(c);d<128?b+=String.fromCharCode(d):d>127&&d<2048?(b+=String.fromCharCode(d>>6|192),b+=String.fromCharCode(63&d|128)):(b+=String.fromCharCode(d>>12|224),b+=String.fromCharCode(d>>6&63|128),b+=String.fromCharCode(63&d|128))
        }return b
    }var f,g,h,o,p,q,r,s,t,i=new Array(80),j=1732584193,k=4023233417,l=2562383102,m=271733878,n=3285377520;a=e(a);var u=a.length,v=new Array;for(g=0;g<u-3;g+=4)
        h=a.charCodeAt(g)<<24|a.charCodeAt(g+1)<<16|a.charCodeAt(g+2)<<8|a.charCodeAt(g+3),v.push(h)

    switch(u%4) {
    case 0:g=2147483648;break;case 1:g=a.charCodeAt(u-1)<<24|8388608;break;case 2:g=a.charCodeAt(u-2)<<24|a.charCodeAt(u-1)<<16|32768;break;case 3:g=a.charCodeAt(u-3)<<24|a.charCodeAt(u-2)<<16|a.charCodeAt(u-1)<<8|128
    }

    for(v.push(g);v.length%16!=14;)
        v.push(0);for(v.push(u>>>29),v.push(u<<3&4294967295),f=0;f<v.length;f+=16) {
        for(g=0;g<16;g++)
            i[g]=v[f+g];for(g=16;g<=79;g++)
            i[g]=b(i[g-3]^i[g-8]^i[g-14]^i[g-16],1);for(o=j,p=k,q=l,r=m,s=n,g=0;g<=19;g++)
            t=b(o,5)+(p&q|~p&r)+s+i[g]+1518500249&4294967295,s=r,r=q,q=b(p,30),p=o,o=t;for(g=20;g<=39;g++)
            t=b(o,5)+(p^q^r)+s+i[g]+1859775393&4294967295,s=r,r=q,q=b(p,30),p=o,o=t;for(g=40;g<=59;g++)
            t=b(o,5)+(p&q|p&r|q&r)+s+i[g]+2400959708&4294967295,s=r,r=q,q=b(p,30),p=o,o=t;for(g=60;g<=79;g++)
            t=b(o,5)+(p^q^r)+s+i[g]+3395469782&4294967295,s=r,r=q,q=b(p,30),p=o,o=t;j=j+o&4294967295,k=k+p&4294967295,l=l+q&4294967295,m=m+r&4294967295,n=n+s&4294967295
    }var t=d(j)+d(k)+d(l)+d(m)+d(n);return t.toLowerCase()
}module.exports=SHA1