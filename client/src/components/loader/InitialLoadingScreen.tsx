import { InlineScript } from "@/components/ui/InlineScript";
import { PawIcon } from "@/components/ui/icons";

/**
 * First-visit intro: the full NESTAMA brand film (silent), full screen. It ends on the logo end
 * card, whose pieces then fly into the header logo while the page fades in underneath.
 * Plain HTML + a tiny inline script, so playback starts while the page is still parsing —
 * no waiting for React. `introPreference` (in <head>) decides whether it shows at all.
 */
export function InitialLoadingScreen() {
  return (
    <>
      {/* The inline player updates these attributes before hydration; React keeps the DOM as-is. */}
      <div id="nst-intro" className="nst-intro" role="region" aria-label="Welcome to NESTAMA" suppressHydrationWarning>
        <video
          className="nst-intro-video"
          muted
          playsInline
          // Nothing downloads unless the intro actually plays: the player script sets the poster
          // and switches to preload="auto". (Repeat visits and reduced motion skip ~0.5 MB.)
          preload="none"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          suppressHydrationWarning
        >
          <source src="/media/intro-854.mp4" type="video/mp4" media="(max-width: 900px)" />
          <source src="/media/intro-1280.mp4" type="video/mp4" />
        </video>

        <div className="nst-intro-footer">
          <div className="nst-intro-caption">
            <p>Getting everything ready for your furry friend…</p>
            <div className="nst-intro-track" aria-hidden="true">
              <PawIcon className="nst-intro-paw" />
              <span className="nst-intro-bar" suppressHydrationWarning />
            </div>
          </div>
        </div>

        <button type="button" className="nst-intro-skip" data-intro-skip>
          Skip intro
        </button>
      </div>
      <InlineScript html={introPlayer} />
    </>
  );
}

/**
 * Runs before paint (in <head>): show the intro once per session; never for reduced motion or
 * Save-Data, and never on the admin (which has no storefront frame). While it shows, the header
 * logo is held hidden so the film's logo can land on it.
 */
export const introPreference = `try{var d=document.documentElement,f=/[?&]intro=1(&|$)/.test(location.search),r=matchMedia("(prefers-reduced-motion: reduce)").matches,c=navigator.connection,s=c&&(c.saveData||/2g/.test(c.effectiveType||"")),p=location.pathname;if(p!=="/admin"&&p.indexOf("/admin/")!==0&&(f||(!sessionStorage.getItem("nst_intro_seen")&&!r&&!s))){sessionStorage.setItem("nst_intro_seen","1");d.dataset.intro="on";d.dataset.introLogo="hold"}}catch(e){}`;

/**
 * Plays the film full screen. When it ends (on the logo frame, t ≈ 9.92 s) the logo's three
 * cut-out pieces are laid exactly over the video, then flown into the header's
 * `[data-intro-target]` elements as the backdrop clears. On narrow screens the "camera" pulls
 * back while the logo forms so it is never cropped.
 *
 * Bail-outs (plain fade instead of the flight): Skip / Escape, autoplay blocked, or no progress
 * for 3 s of *visible* time (slow start or stall; a background tab pauses the film instead of
 * ending it, and it resumes when the tab is shown). The site is `inert` meanwhile.
 * Piece rectangles are in the film's 1280×720 frame; they come from the logo cut-out
 * (docs/brand-assets.md).
 */
const introPlayer = `(function(){
var d=document.documentElement,root=document.getElementById("nst-intro");
if(!root||d.dataset.intro!=="on")return;
root.dataset.player="";
var v=root.querySelector("video"),bar=root.querySelector(".nst-intro-bar"),skip=root.querySelector("[data-intro-skip]"),done=false,landed=false,zoomed=false,last=-1,still=0,wd;
v.poster="/media/intro-poster.jpg";v.preload="auto";v.load();
var P=[["mark",425,102,433,300],["word",254,405,781,144],["tag",399,556,472,29]],SRC={mark:"/brand/nestama-mark.webp",word:"/brand/nestama-wordmark.webp",tag:"/brand/nestama-tagline.webp"};
var pieces=P.map(function(p){var i=new Image();i.alt="";i.className="nst-intro-piece";i.src=SRC[p[0]];if(i.decode)i.decode().catch(function(){});return i});
function site(){return document.getElementById("site")}
function onKey(e){if(e.key==="Escape")finish("escape")}
function onShow(){if(!document.hidden&&!done&&v.paused&&!v.ended)play(1)}
function stop(why){if(done)return false;done=true;root.dataset.end=why;clearInterval(wd);document.removeEventListener("keydown",onKey);document.removeEventListener("visibilitychange",onShow);return true}
function release(){var s=site();if(s)s.removeAttribute("inert");d.removeAttribute("data-intro-logo")}
function finish(why){if(!stop(typeof why==="string"?why:(why&&why.name)||"unknown"))return;
root.dataset.state="leaving";release();setTimeout(function(){root.dataset.state="done";try{v.pause()}catch(e){}},450)}
/* A rectangle of the 1280x720 film frame, in viewport pixels (the video box is exactly 16:9). */
function frame(x,y,w,h){var r=v.getBoundingClientRect(),sx=r.width/1280,sy=r.height/720;return{x:r.left+x*sx,y:r.top+y*sy,w:w*sx,h:h*sy}}
function pullBack(){zoomed=true;var b=frame(254,102,781,483),m=Math.max(16,0.05*Math.min(innerWidth,innerHeight)),k=Math.min(1,(innerWidth-2*m)/b.w,(innerHeight-2*m)/b.h);
if(k<0.98){root.dataset.zoom="";v.style.setProperty("--nst-zoom",k.toFixed(4))}}
function handoff(){if(!stop("ended"))return;
pieces.forEach(function(im,i){var r=frame(P[i][1],P[i][2],P[i][3],P[i][4]);im.style.cssText="left:"+r.x+"px;top:"+r.y+"px;width:"+r.w+"px;height:"+r.h+"px";document.body.appendChild(im)});
v.style.visibility="hidden";
setTimeout(fly,380)}
function fly(){root.dataset.state="handoff";
var runs=pieces.map(function(im,i){var t=document.querySelector('[data-intro-target="'+P[i][0]+'"]'),s=im.getBoundingClientRect(),r=t&&t.getBoundingClientRect(),kf;
if(r&&r.width>0&&r.bottom>0&&r.top<innerHeight){var k=r.width/s.width,dy=r.top+(r.height-s.height*k)/2-s.top;kf=[{transform:"none"},{transform:"translate("+(r.left-s.left)+"px,"+dy+"px) scale("+k+")"}]}
else kf=[{opacity:1},{opacity:0}];
return im.animate?im.animate(kf,{duration:1050,delay:i*70,easing:"cubic-bezier(0.65,0,0.25,1)",fill:"forwards"}).finished:Promise.resolve()});
Promise.all(runs).then(land,land);
/* Animations only advance while the page is visible; never leave the site locked waiting on them. */
setTimeout(land,2600)}
function land(){if(landed)return;landed=true;root.dataset.state="done";release();try{v.pause()}catch(e){}pieces.forEach(function(im){im.remove()});
var m=document.querySelector('[data-intro-target="mark"]');if(m&&m.animate)m.animate([{transform:"none"},{transform:"scale(1.12) rotate(-4deg)"},{transform:"none"}],{duration:450,easing:"ease-out"})}
document.addEventListener("keydown",onKey);skip.addEventListener("click",function(){finish("skip")});
var lockSite=function(){var s=site();if(s&&!done)s.setAttribute("inert","")};lockSite();document.addEventListener("DOMContentLoaded",lockSite);
setTimeout(function(){if(!done)skip.focus({preventScroll:true})},60);
document.addEventListener("visibilitychange",onShow);
v.addEventListener("timeupdate",function(){var t=v.currentTime;if(v.duration)bar.style.width=Math.min(100,t/v.duration*100)+"%";if(t>=7.6)root.dataset.phase="logo";if(t>=8.2&&!zoomed)pullBack()});
v.addEventListener("ended",handoff);
var srcs=v.querySelectorAll("source");if(srcs.length)srcs[srcs.length-1].addEventListener("error",function(){finish("source-error")});v.addEventListener("error",function(){finish("video-error")});
function play(retries){var p=v.play();if(p&&p.catch)p.catch(function(e){var n=(e&&e.name)||"rejected";
/* AbortError = a newer load interrupted this play() (e.g. source re-selection as a mobile viewport settles): retry once it can play. */
if(n==="AbortError"&&retries>0&&!done){v.addEventListener("canplay",function(){play(retries-1)},{once:true});if(v.readyState>=3)play(retries-1)}else finish("play-"+n)})}
play(2);
/* Watchdog: hidden time does not count, so a background tab never loses its intro. */
wd=setInterval(function(){if(document.hidden)return;var t=v.currentTime;if(t!==last){last=t;still=0;return}still+=250;if(still>=3000)finish(t>0?"stall":"slow-start")},250);
})();`;
