/** Hostnames that should use NCC institutional chrome (white canvas, no Alta ivory). */
export const NCC_SITE_HOSTNAMES = [
  "newportclearingcorporation.com",
  "www.newportclearingcorporation.com",
  "ncc.altagroup.dev",
  "ncc.localhost",
] as const;

/**
 * Runs before paint to avoid Alta ivory flashing on NCC hosts.
 * Keep host list aligned with SITE_CONFIGS.ncc.productionHosts + ncc.localhost.
 */
export const SITE_INIT_SCRIPT = `
(function(){try{
  var h=location.hostname.toLowerCase();
  var nccHosts=${JSON.stringify(NCC_SITE_HOSTNAMES)};
  var isNcc=nccHosts.indexOf(h)!==-1;
  if(!isNcc&&(h==="localhost"||h==="127.0.0.1")){
    isNcc=new URLSearchParams(location.search).get("site")==="ncc";
  }
  if(!isNcc)return;
  var root=document.documentElement;
  root.classList.add("ncc-site");
  root.classList.remove("dark");
  root.style.backgroundColor="#ffffff";
}catch(e){}})();
`;
