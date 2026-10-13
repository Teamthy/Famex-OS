0- Project Preview
0:00
If you want to build and launch a real mobile application using AI, this tutorial is for you. We are not building
0:06
some random demo application that looks good for 5 minutes. We are building a modern AI trip planner that you can run
0:14
on your actual phone, share with your friends, and even use as a real product.
0:19
I'll show you the exact workflow that I use to design beautiful apps with AI and
0:24
then turn those designs into real working mobile apps. Just for context, I
0:30
built and deployed my own mobile app to the app store in only 14 days. It's a
0:36
calorie tracker app called Bulky AI, and I got my first customer just 5 days
0:42
after the launch. If you're curious and want to test this out, feel free to check it out. It's on the app store. So,
0:48
that's the proof that I know what I'm talking about. And in this video, I'm going to share everything that I know for completely free. Before we start
0:55
coding, let me quickly show you the end result so that you know what we are building in this course. So this is an
1:01
AI trip planner app where users need to sign in before using it. We have two
1:06
different authentication options which are Google and Apple. If you want to add more options, I'll show you how to do it
1:13
later in the video. Once you sign in, you will see four different tabs which are home, AI assistant, trips, and
1:20
profile. And as you can see, we have this beautiful iOS liquid glass effect because we are using native tabs. From
1:27
the home screen, you can start planning a trip with AI by pressing the get started button. So here, let's say I
1:34
want to visit Tokyo, Japan. I can select my travel dates, budget, number of
1:39
travelers, interests, and travel pace. Once I press the generate button, OpenAI
1:45
will create the trip in the background. Then we will be redirected to the trip details screen where we can see the full
1:52
trip, a day-by-day itinerary, places to visit, things to do, and a map with all
1:58
the locations. And if I don't like something in the plan, I can use the AI assistant to change it. For example, I
2:05
can ask it to make the trip more relaxed, add more local food, lower the
2:10
budget, or really anything custom. So that's how you generate a trip. On the
2:16
home screen, you can also see your latest trip and popular destinations.
2:21
From the assistant tab, you can chat with AI about anything, but we will mainly use it to get ideas and
2:28
suggestions for our trips. In the trip screen, you can see every trip you have
2:33
generated. And finally, in the profile tab, you can see your account details,
2:38
log out, and even delete your account. Deleting your account will also remove all of your data from the database as it
2:45
should be. And by the way, this delete your account is not really an optional feature. If you want to deploy your app
2:52
to the app store, this is a feature that you have to have, otherwise Apple will reject your application. So, we're going
2:58
to talk about these kind of tips and tricks later in the video. We will also add a rate app button so users can leave
3:06
a review. On top of this mobile application, we are going to build a landing page for the web. And it's going
3:12
to contain a privacy policy, terms of service, and a support page with an
3:17
email address. And again, these are the things that you need to have if you want to publish your application to the App
3:23
Store. And throughout this tutorial, I'm going to share these kinds of tips and tricks that you need to know before
3:29
deploying your app to the App Store. And I'll even show you how to create these types of beautiful app mockups for your
3:37
future projects. Now, this is not a VIP coding tutorial. So, we are not going to
3:42
randomly ask AI something like build me a mobile app and don't make any mistakes
3:47
or fix all the issues. If you have ever used AI, then you know that those prompts almost never work. So, instead,
3:55
we'll use a structured workflow. And this is the exact same workflow that I used to build and launch my own app in 2
4:03
weeks. I have actually documented that entire process day by day inside my
4:08
school community. But it is not just a course where you watch videos and disappear. It's also a community of
4:14
developers who are sharing their own progress, asking questions, getting feedback, and launching real apps. And
4:22
one of our students has already built and deployed their own application in 14
4:27
days just by following along with us day by day. And to be honest, it's pretty cool to see that this workflow actually
4:34
works. And this is kind of like the proof. So if you want to go deeper after this tutorial and build your own
4:40
application alongside us, I will leave the link in description. Feel free to join us. Now with that said, let's talk
4:47
about the text tag of this project. And I have to say that we are using some of the best tools out there. First off, we
4:54
are going to use React Native with Expo. And this is genuinely one of the best ways to get started with mobile
5:00
development. And this was the exact same text that I used to launch my app. For
5:05
authentication, we are going to use Clerk, which is pretty easy to integrate and it is ready for production. In my
5:12
own application, I have also used clerk and I have integrated Google, apple and
5:18
email options. And in this video, I'm going to show you how you can do it as well. For the database, we are going to
5:23
use Postgress which will be provided by Neon. They're going to host everything in the cloud. So, we don't need to worry
5:30
about managing our own database server. For error tracking and monitoring, we will use Sentry. This will allow us to
5:37
see the errors that real users get inside the application. So we can just
5:42
jump into our codebase and fix them quickly. For background jobs we will use ingest and for image optimizations we
5:50
will use image kit and also we will use code rabbit as our AI code reviewer.
5:55
Basically it will scan our codebase and let us know if we have any issues and
6:00
how to fix them. Now the best part is all of these tools are completely free to get started with. So you don't need
6:07
to pay anything to be able to follow along. I will provide some special links in the description. If you sign up with
6:14
those links, you will get extra free credits. Okay, so with all that said, grab your copy and let's get started.
1- Planning Our Project & Tools Setup
6:21
All right, so to get started with you just need an empty folder which is opened up in VS Code. You can use any
6:27
kind of code editor, but in my case, I'll be going with VS Code. And for the folder name, I came up with this name
6:34
called triply, but you can really call this anything that you wish. Before we jump into coding, I'd like to mention
6:40
that every single one of you needs to have Node.js installed in their machine. This is the only prerequisite that you
6:46
need to have. I think most of you already have it, but just in case if you don't, go ahead and visit node.js.org.
6:53
And from here, just press the download link and then everything would be selected for you automatically. Just go
7:00
ahead and install it. Once you have that, you can double check just by opening up your terminal or I think
7:07
PowerShell if you're on Windows. You would just say node- version and if you
7:12
see a version that means it has been installed successfully. Okay, so with that said, now I have another thing that
7:19
I want to mention pretty quickly. So the goal of this tutorial is not really getting the exact same end result. So it
7:26
is fine if you get a little bit different UI than what I get because AI doesn't really give the exact same end
7:32
result to everyone which is absolutely fine because the goal of this tutorial is understanding the workflow to build
7:40
actual apps. So if you understand this workflow I am pretty sure that you will be able to build your own app in 2 weeks
7:47
as well. Like this is my app. Again I just want to mention it. It took me exactly 14 days to build it and deploy
7:55
it to app store. And this is one of our students app. He also just follow along
8:00
with me every single day. And then he has his own application which is
8:05
deployed on app store. Right now this is not a VIP coding tutorial. Right? So we
8:11
will not just go ahead and randomly ask something to AI but instead we will have a structured workflow and I'm going to
8:18
get into that in a couple of minutes. And now I see some of you guys are very very depressed because you know like
8:25
thinking AI can build anything and some of you guys are really excited thinking
8:31
AI can build anything. Well, I'm definitely one of these guys. I never been this one and I think I'll never try
8:38
to be. Um yeah, so I just found the opportunity like AI can build anything.
8:44
Let me just go ahead and build a mobile application, right? build it, deploy it
8:49
to app store and start making some money. This is the actual screenshot from my own iPhone right from revenue
8:57
kit. Like I'm starting making some money. I got I think four or five
9:02
different subscriptions so far. Some people subscribe to monthly, some people subscribe to yearly. But yeah, um if you
9:10
try to kind of like be futuristic, I think eventually you'll make some money with AI. And my goal is to kind of like
9:18
show you the entire workflow in this tutorial. Now, speaking of AI, you can use really any tool that you wish. I'll
9:26
be using claw, but you can use cursor or codex. I don't know, windsurf, Gemini.
9:32
It could be really anything. Now, I would say just feel free to spend at least $20 a month in one of these tools.
9:41
Even though I know that this is not really possible for everyone. Some of you guys are students. Um like the worst
9:49
case what you can do get the Codex. Let me just show you that. I'm going to say Codex
9:55
pricing because they have like $8 pricing. Yeah. Um this one like at least
10:02
you can get this one. You can also use the free plan but it is just like it's not going to be enough to build this
10:08
kind of an app. It is just for exploration I would say. So if you're smoking just then I would say stop
10:15
smoking to be able to afford one of these or if you're going to cinema every here and then just stop doing it. Right?
10:21
So you get the point. I think just find a way to make $20 a month and pay in one
10:27
of these tools. In my case I'll be using cloud but you can use any other tools.
10:33
The workflow will mostly be the same. Now, as I said, I'll be using cloud code and there are a couple of different ways
10:39
of using it. You can use it from the terminal. You can get their, you know, their Mac desktop application or I think
10:46
for Windows, they also have it. Basically, it's a desktop app or you can use it in VS Code. This is what I'll be
10:52
doing. You can just go ahead from the extensions. You can install the cloud um
11:00
let me just show you like cloud code extension. you need to sign in and then you will be able to use it. So it is
11:06
this one pretty popular like I'm going to get into the usage but yeah this is
11:12
what I would say for this tutorial. Just don't really be stressed about AI because you cannot really change it then
11:18
instead learn how to build apps and hopefully start making some money.
11:26
Now with that said let's talk about the workflow that we're going to have in this course. So before we write a single
11:32
line of code, first we will plan and describe our entire project to AI. So
11:38
we're going to define the idea, goals, features, pages, user flow, and text
11:44
tag. Like what I would do is just spending the first day with the entire
11:49
plan because if you don't know what you are building, how would AI know, right? You can use AI to, you know, suggest you
11:56
all kinds of features and eventually come up with a fully completed plan. And
12:02
this is what we'll try to do. Once we have the plan, we are going to use a structured prompt to generate the UI
12:09
design. So, we're going to get the screens, layouts, and visual style. We will even get a design system. Then,
12:16
once we have the UI design, we will just break it into features. So let's say our
12:22
first screen is authentication page, right? So we'll go ahead and design it. Sorry, we will implement it. Actually,
12:29
we already designed that. And then once we build one feature, first we will
12:34
check it by ourselves, right? So we will test manually. And then we are going to
12:39
run an AI code review just to check if we have any issues, you know, security
12:45
problems in our codebase or not. And if if we have some problems then we'll go
12:50
through this couple of times until we don't really have any issues. So once the feature is completed we're going to
12:57
save the progress by committing our code. Then we will go into the next step. So we will check if we have more
13:04
features then we will do this workflow all over again. Eventually we're going
13:09
to have no no more features left. So the project will be completed. Okay. So you
13:15
can take a screenshot or actually you you don't have to because I'm going to provide these diagrams for free in the
13:21
description. Now with that said, let's talk about the text tag that we're going to be using. First off, let me close
13:27
these tabs. I will go right here and I'm going to search for expo.dev/documentation.
13:34
And you can take a look at the expo.dev itself. Like pause the video and take a look at it. This is really one of the
13:41
best ways to build mobile apps. And it is completely production ready. Like you can see all these apps are built with
13:48
expo and they're like very very large actual applications. Um so yeah we will
13:56
go into their documentation and they have this script. Let me zoom in. It is called MPX create expo app at latest. So
14:05
I'm going to copy it and go into VS Code. I'll open up my terminal. I'm going to just paste this in. At the end,
14:13
I'm going to put dot, which means initialize this expo application under the current folder. So, I'm going to go
14:19
ahead and run this here. I'll be going with the latest SDK. At the time that
14:24
I'm recording this video, it is 56, but when you're watching it, if it is something like 57 or 58, that's
14:32
completely fine and go ahead, you know, follow along with it. Okay. So, I'm going to run this. This is going to get
14:39
bunch of different files and folders basically like a template.
14:45
So this will try to install the dependencies and you will see that we have bunch of different components
14:51
constants you know hooks so on and so forth. We will basically delete most of them and we will start from absolute
14:58
scratch. And there is a script under the package JSON. Let's just scroll to the
15:03
bottom. This is called reset project. Basically, it is going to run this file
15:10
like you can see what this does. But essentially, it is going to delete most of them, right? It's only going to leave
15:17
one single file or a folder. Let's try to run it. This is a script that expo
15:24
team provides you by the way. It is this one, right? So, if you want to delete
15:29
most of them, they say you can do it with this one single line. So, I'm going to say mpm run reset project.
15:40
And it says, do you want to move existing files to an example folder instead of deleting them? I want to
15:47
delete. So, I'm going to say no, just go ahead and delete. So, press N and then press enter. Okay. So as you can tell
15:54
everything has been deleted or I would say most of the things we only have the
15:59
source app folder then three different actually two different files not three.
16:05
Okay so with this we have a very basic mobile application that we can run at the moment. And by the way if you have
16:12
never used expo or react native before I have a full crash course for completely
16:17
free on the channel. I'm going to link it in the description. It is around 2 hours and like you will see some really
16:23
really good comments. Everyone really really liked it. So here in this video we will not use AI at all and I will
16:31
explain everything step by step. If you're interested you can double check that it has been published 8 months ago
16:37
but it is still very I would say up to date. Even if you watch it like 4 years
16:42
later it'll still be up to date because the general idea is going to be the
16:48
same. We are using the same text tag which is React Native and Expo. Okay. So
16:53
with that said in this in this tutorial I'm not going to give you a full crash course on Expo or React Native. If
17:00
you're interested you can check out this video. So with that said we want to start by planning this project. Now
17:07
again you can use cloud, you can use any kind of AI model, different AI agents
17:12
really it could be anything. In my case, this is how I can start cloud in VS Code
17:18
by pressing this button. So, I'm going to get a cloud code instance. Now, here
17:23
in cloud, if you have never used it, there are a couple of different modes, right? In our case, we will start with
17:29
the plan mode. And I think automatically you will get with the auto mode like you will get started with this one, but you
17:36
can always say change it. So I would usually use plan mode whenever I want to plan a feature or in this case the
17:43
entire project and if I need to build something I would just leave it in the
17:48
edit automatically right so it would edit any kind of files without asking me if you go with the ask before edits it
17:55
is going to ask for a permission before doing anything and I think this is the one that you would like to get started
18:01
with initially just to understand like how that work but once you understand
18:07
and it then I would say just leave it as edit automatically. Okay.
18:13
So with that but you know just be careful this could sometimes delete some files. So you would like to always keep
18:19
track of every single file with get and this is something that I'm going to show you as well. Okay. So with that said
18:26
first off I'm going to select the plan mode and I'm going to give you a prompt which is like project agnostic. You can
18:33
use it in any kind of future projects. And by the way, for the model, you can
18:39
really use anything. I think in my case, I'm using the default, which is Opus 4.8
18:45
at the moment, but you can really use any other models.
18:51
Okay. So, let me just go ahead and show you the prompt to plan the entire
18:56
application. So, I'm going to leave this as a link in the description. Go ahead and copy
19:02
everything like from start until the very end. And the goal of this prompt is
19:08
basically making sure that AI will ask us all kinds of questions about this
19:14
project. It is like kind of interviewing us so that AI doesn't really guess any
19:19
future. And let's try to read this prompt out loud. So we basically say you are my senior technical co-founder and
19:26
product architect. I'm about to build a new software project and I want us to be
19:31
in complete alignment before writing any single line of code or you know the final plan is written. So basically the
19:39
job of AI is not to write the code initially but instead to interview us
19:45
about this entire project. Now again the goal of this so that you know AI doesn't
19:51
really guess any future but instead asks me all kinds of questions about this
19:56
project. Okay. So, it's going to ask me like for authentication, do you want to implement only Google or Apple or even
20:04
both of them, right? Or even any kind of different things. So, you get the point.
20:09
This is for us to be in the same page with AI. And this is what I would do
20:15
like this is what I have done to build any kind of apps really. So, I want you to copy this entire prompt.
20:23
Then we will go into cloud code. So from here you will select the plan mode and
20:29
here by the way it says like it takes this file into the con context but you
20:35
can you know just press that and toggle it. It's not really that important. Just
20:40
paste your prompt. So you can paste this prompt to any kind of project. Once you
20:45
paste it, you would like to describe your actual application. And this is what I'll be doing. You can either type
20:52
this out or even better, you can press this and start talking. And this is
20:57
exactly what I'm going to do. Okay. So the project that I want to
21:02
build is going to be an AI trip planner. For the text tag, I want to use clerk
21:09
for authentication. Neon for postgress database. I want to use ingest for
21:15
background jobs. And I want to use image kit for image optimizations and
21:22
transformations. So here I realized there is a typo. I'll go ahead and fix it. I'm going to say tech stack.
21:30
Okay. And then I'll continue talking to error tracking and monitoring. Obviously
21:37
I'm going to be using Sentry. And when it comes to the authentication, I want
21:43
to include I think Google and Apple option for now. I'd like to skip the
21:49
email authentication. Now here I just pause it. You don't really need to provide these because it's going to ask
21:55
you in the interview in a second, but I just wanted to mention it still. The
22:01
other thing that you would like to do is describing the goal of this project, right? So here I'm going to go ahead and
22:07
say something like basically users will use this application to generate trips
22:14
powered by AI. So let's say I just signed up. I will get to the home screen
22:20
and from the home screen I can say something like generate a trip. So I'm
22:25
going to give the location that I want to visit. Let's say Japan, Tokyo. Then
22:31
how many days I want to stay. Then maybe amount of travelers like one person, two
22:37
people etc. and maybe like the budget. So these kinds of questions and user
22:45
will say generate the trip and yeah the trip will be generated by AI. We will
22:52
see some kind of a loading screen and then you know user will be redirected to
22:57
the trip detail screen. So I hope you are able to see what I'm doing here.
23:02
basically describing the project in a high-level overview. Now, it is not
23:08
maybe unfair because I have already built the project as you can tell like this is what I built in the intro that
23:14
you just watched, but that was the exact same workflow that I have done. Of course, I didn't really provide all
23:22
kinds of details. it's going to be answered with the interview in a couple of minutes. But yeah, just go ahead and
23:29
you know describe the basics of your application. I would say go ahead and decide your text tag from the start. So
23:36
I always want to have my text tag determined by me, not really by AI. So I
23:42
know the I know the tools that I'm using rather than asking AI to come up with
23:47
the options. But other than this, I'm going to leave everything for AI to decide for me. Right? And I think with
23:54
this now, we can go ahead and run this. So since we are in the plan mode, we are
24:00
going to get bunch of different questions. And the end result that we might have could be a bit different than
24:06
this one, right? Because AI doesn't really give the exact same end result every single time, but the general idea
24:13
will be the same. And when I was building it, like initially to be honest, I didn't really had this
24:19
assistance screen in mind at all. But as I built the plan and as I added the
24:25
other screens, like at some point AI tell me something like maybe I can add
24:32
an assistant screen, right? So you can't really decide every single feature from the start, but you can try to minimize
24:39
the guesswork from AI, right? So that's the goal of the plan mode that we are
24:45
using right here. So this is going to kind of like first read your codebase, right? It says okay I understand that
24:52
you have a fresh expo application. Now we have bunch of different questions
24:57
that we'll answer. Okay. So here it says which AI model should generate the
25:03
trips. In my case I already have an open AI key. So I'm going to say go ahead and
25:09
use this one. Now, since this is clot, it says antrophic is kind of like recommended, but I already have some
25:16
credits in OpenAI. So, I'm going to select this one. And if you don't really want to spend any money, then you can
25:22
select Google Gemini. I think they have a free plan. So, in your case, if you want to select OpenAI, you only need to
25:30
spend $5. But again, I think Google Gemini will be free to get started with.
25:37
Okay. So, I'm going to select this one. and then we'll get into the next project. For the back end, do we want a
25:43
separate node back end or export router API routes? This is recommended for
25:48
version one. And this is what I'd like to use. Basically, we don't really need to build a separate back end, but
25:55
instead under the source under the API folder, we can build our API routes.
26:01
Okay, this is what it says. I'm going to be using this one. Then here it says trip generation in async using ingest.
26:09
How does the mobile app learn the trip is ready and move from loading screen to detail screen. So I'm going to use the
26:16
pol DB for status and you can take a look at the other
26:22
options like push notification realtime subscription but I think this is this is
26:27
what I'll be going with. And then the other question is what does a generated trip actually contain? Now in our case
26:34
in the end result this is what I really liked. So we have a full itinerary as
26:40
you can tell like if you scroll this is what you would see and then we have like a map and some details. So in my case I
26:48
think I'm just going to select this one and you can always update this in the future right so here I'll just say
26:55
dayby-day itinerary and I think we can select a couple of different things. So, I'm going to say the budget background.
27:02
Sorry, breakdown, not background. Um, we can say, yeah, places
27:09
hotel suggestions. Should we get them as well? Yeah, let's go ahead and actually select this one. Why not? So, once you
27:15
have all of them, all of them answered. You can also just add different thing, right? So, you can really add any kind
27:21
of custom message if you wanted to. And then you can submit the answers.
27:27
So I think it's going to ask us some more questions. I believe eventually
27:32
once you answer everything you're going to get a plan. So this plan will be generated in a plan.md file and then we
27:41
will just follow that plan step by step. Now the other questions we got are about
27:46
place data maps or generation limits. I think here for the first question I'll
27:52
go and say use LLM text only no photos for the version one. So I'm going to say
27:59
going to the next question. Do places need to render on a real map in the trip
28:04
detail screen. So I'm going to say yes interactive map. I think this could be a
28:11
small map just like this one. Um here is one catch. If you're using goo, sorry,
28:17
if you're using Apple Maps, you don't really need any API keys. But if you're going to be using Google Maps on Android
28:23
or even like on iOS, for Google Maps, you're going to need an API key. So
28:29
here, I'm just going to say maybe let's just other answer. For now, I'm going to say only use
28:38
iOS maps or let's just say Apple Maps without any API keys set up. Skip
28:48
Google Maps for V1. Right. Okay. So, I'm going to go into the next question.
28:55
Obviously, I want to use the result RM. I think Prisma also really really good but I think there is the result is just
29:03
is going to be my option. Then the generation limits basically it says if
29:09
you want to make this application paid initially I'll just make it free like
29:14
it's going to be for the version one and I'm going to submit my answers now once
29:19
I answer those questions I got a followup by claude. It says you originally listed image kit for image
29:26
optimization but LLM text only means there aren't really place photos to
29:32
optimize in version one. Now this is such a beautiful followup but we will be
29:37
using image kit for different things for now. I'm going to ignore this. And here
29:42
it also says that Apple Maps with no API key only works on iOS. Android would
29:50
need Google Maps and an API key. So here the follow-up question is which platform
29:57
are in scope for v1. Now in my case I want to build it for only for iOS but if
30:04
you are building it for Android as well or even for web you can select one of these options. I'll be going with iOS
30:11
only for version one. Okay. So let me zoom in as well. So here
30:18
it says when it comes to the image control what do you want to have? Now, one of the use cases that I want to use
30:24
image kit for is going to be the user profile photos. And the other one, let
30:30
me just actually go with the other option. I'm going to say use image kit
30:35
for user profile photos and custom
30:41
cover images for trips for generated trips. And let me show you the end
30:47
result. Basically within the trip screen, this background is generated by
30:52
AI automatically. But if you wanted to update it, you can press this button and
30:58
upload a custom photo, right? And we would like to use image kit here to optimize the image. So that's that
31:07
option that I just passed. Um, let's go into the next question. It says, "What
31:12
inputs does the generation form collect beyond location, days, travelers, and
31:18
budget?" Let me just show you that form. So, when you say get started,
31:25
what you're going to see, I think I didn't take the screenshot. Let me just go ahead and grab it. So, here is what I
31:32
had in the version that I built previously. Basically the place to go,
31:37
the exact dates, the budget, should it be budget friendly, comfort or luxury,
31:43
travelers, this is the count like either 1, 2, 3, etc. Interests and travel pace.
31:51
Now you can add more if you got different questions but in my case I'll say the exact actual start date
32:00
interests like the trip style is it going to be food related you know history nightife nature etc. And then
32:07
we'll say budget as tiers. Yeah I think I'll just select three of them. And then
32:13
I'm going to go into the very last question. It says what does a returning
32:18
user see on the home screen? So this is how our home screen will look like. Basically we have a get started button
32:26
that will take us to the screen and then we have the latest trip then some
32:31
popular destinations. But here in your case you will not really know what to build initially because this design will
32:38
be generated by AI in a couple of minutes. So first what you would like to say is coming here selecting the other
32:46
option and just say something like I will provide the UI design later right
32:53
and then we're going to submit the answers and then we got the next batch of questions so here it says clerk owns
33:00
the authentication but neon also needs the users right so in this case how do
33:05
we want to implement it we'll be using web hooks if you don't know what that is I'm going to explain in the incoming
33:11
sections. It's actually a pretty important concept to understand especially for people who are using AI
33:18
and VIP coding, right? So, web hook is one of those concepts that you must know
33:24
and I'll try to explain in a way that every single one of us understand it.
33:29
For the cover image, I'll be using something like Unsplash. We can also use AI generation, but it's going to be kind
33:36
of like paid. Um I think this is completely fine for the version one and
33:41
this is actually the recommended option. Then here it says what should happen when the generation fails. I'm going to
33:48
say inest should auto retry then fail gracefully. Then for the trip actions we
33:55
can let me show you the end result actually what we want to have. So in the trip details screen, if you press this
34:02
button, you can delete it or at the bottom you can press this AI button and
34:09
regenerate the itinerary. So here I'm going to say we should be able to view and delete maybe edit
34:17
itinerary with AI, right? Okay. So here I'll actually say should I select this
34:24
one? Yeah, let me just go ahead and say other just to make sure we don't really have
34:29
any vague answers. I'm going to say view and delete.
34:35
I'm also going to say an AI button like
34:40
a chatbot where user can ask
34:46
modifications to the current trip.
34:53
So when you press this button, you will see a UI like this and you can say, you
34:59
know, make it more relaxed or more budget friendly, add more local food, so
35:04
on and so forth. Okay, so I'm going to go ahead and submit these answers as well. So we got
35:10
some more questions about the AI chat feature. Here it says, when a user chats
35:15
to modify a trip, what does the AI actually do? So in this case, I'm going to just go with the recommended option.
35:22
You can read it, but this is really what I'd like to have. Then we would like to keep this synchronous in the chat, which
35:29
is also the recommended option. And here I want to say that most of the time the recommended option is what you'd like to
35:36
go for. But sometimes it just happens that you want to select a different option. So instead of randomly selecting
35:43
the recommended, I would say you know just take one minute and read every single one of the options. Then for the
35:49
chat history of course I want to persist it. Then we can add kind of like a delete button. Let me show you. Like
35:57
here user can you know delete all the previous messages if they really wanted
36:02
to. For the kod here, I'll just say the other option. I'm going to say no billing or pay wall at all for version
36:11
one. So everything will be free. So just imagine, let's say, imagine
36:20
no payments for V1 at all.
36:25
And then I'm going to submit my answers. Now here again we got a really important
36:31
and actually a good followup from Claude. It says okay you don't really have any paid plans but it would be
36:38
better if you can add kind of like a rate limit daily for user. So in this
36:43
case it says at least put some kind of a rate limit like 20 generations per user
36:49
per day. Okay. So I'm going to select this one. And then it says which open a model tier for generation and chat
36:56
edits. So, I'm just going to use the cheapest one because the goal of this tutorial is not really building the best
37:03
product out there, but instead having something that works and I can teach you the workflow. I'll go with the cheapest.
37:12
So, like I'll just say use the mini mini model everywhere. And I think I'm just going to say submit
37:18
the answers. All right. So once you answer every single question eventually you're going to get an answer like this
37:24
by cloud like I have everything that I need. Let me go ahead and write up the full spec and the plan implementation.
37:33
Now it's very important for you to not really say yes and auto accept before reading the entire plan. What I would
37:40
do, I would pause the video and if I'm building an actual project, I would just maximize the screen and just read the
37:47
entire plan because there could be things that you don't really like, especially since you're using AI. Like
37:54
there will be definitely something that you don't really like. Maybe it'll be 100% what you want, but I would say it's
38:01
really important for you to take like five to 10 minutes and read then decide
38:07
if this is what you'd like to have. In my case, I have already read it off camera and I found something that I want
38:14
to let Claude kind of like inform it about this. Okay,
38:19
so here it is. This one like it says, you know, there is something called EAS
38:24
hosting. By the way, this is the hosting service by Expo. We'll get into that as
38:30
well. It says hosting a durable injest endpoint and longunning generation
38:35
inside export router API routes needs validation against version 56
38:42
documentation. So here there could be some timeouts. What I'm going to say instead of saying yes and auto accept
38:48
here I'll say I liked the entire plan. Keep everything as it is.
38:56
But for the open risk and unknowns, let me just copy it. And I'm going to
39:03
reference the R1 like the risk one. I'll say we want to use inest development
39:11
server. So initially we don't really want to use the EAS hosting for our API
39:16
routes. Okay. So this is what I'm going to say. say we want to
39:23
use the ingest dev server and not really deploy let me
39:32
fix this deploy something to EAS hosting
39:37
at the start okay and then I'm going to say keep this
39:43
in mind and have my plan as it
39:51
So hopefully this will go ahead and update this part. So here it says let me update that part
39:59
in the plan. So after 10 or 15 seconds it's been implemented. As you can tell
40:05
it has updated this part. So I'm going to say yes and auto accept. Now once you accept that plan will be approved and
40:12
cloud will generate a list of to-dos. It'll put everything in different phases. So it's going to start from the
40:19
very first phase all the way up to the very end one. Now of course I don't want to implement everything in the first go.
40:27
What I'll be doing I think I'm just going to stop this which is completely fine. I'm going to say you know get this
40:34
plan and put it into a plan MD file. So at least I can see like what phase that
40:40
we are currently at. So this is what I'd like to do. I'm going to go ahead and say so we have this plan I want you to
40:48
put it under a plan MD file with every single phase like um basically a list of
40:55
to-dos and then as we complete any of these features we will mark them as
41:01
completed. So for now don't really implement anything other than building the plan MD file.
41:09
So here before you submit that just go ahead and maybe fix these typos even
41:14
though it's not really important but I'm going to say plan MD and actually I'm going to make this to be all uppercased
41:21
like this. Okay. So I'm going to go ahead and run
41:27
this. Now while this is building the plan MD file, what I'd like to do is
41:33
creating the MV file from the start. So I'm going I'm going to put all kinds of
41:38
environment variables so that AI can just really implement all of them instead of waiting for us to get the
41:45
environment variables. And what you would like to do is going under the get ignore file and adding thisv at some
41:53
point like just really anywhere so that this file would be get ignored and we
42:00
don't really push our secrets to GitHub. and let me give you all the keys and
42:05
like the values that you would need for your environment variables. All right, so here are most of the environment
42:11
variables that you would need. If you don't want to type them out by hand, I created the env.example file. You can
42:18
find this in the source code. It is also completely free. Just go ahead find this
42:23
file, copy everything and paste it into yourv file, right? So you don't really
42:29
need to create this file, but make sure to create the env file. Then paste
42:35
everything. Now for the values, I'm going to show you how to grab them. So basically for clerk, we'll have three
42:42
different values. One for database, one for the AI key. In my case, I'll be
42:47
using OpenAI, but you can use Gemini and traffic or really anything. and then two
42:54
different keys for Unsplash, one for ingest for the development mode. In
42:59
production, I'm going to show you what you would need, then three different keys for image kit. Now, for all these
43:05
tools, I'm going to provide you some special links in the description. Basically, you're going to get some free
43:11
credits and free plans without paying anything. So, go ahead and sign up
43:16
starting from Sentry. This will be for you know this will be the platform that we will use for error tracking and
43:23
monitoring in our application. Basically when your users get some errors sentry
43:28
will immediately send you an email. So you can just jump into your codebase and fix it immediately before other users
43:36
encounter the same issue. And this is what I'm using in my actual application
43:42
as well. Then you need to sign up to neon to get the free Postgress database.
43:48
Again link will be in the description. For now just go ahead and sign up for
43:53
these tools. Also for clerk will get beautiful components. Everything will work out of the box. For background jobs
44:00
we'll be using inest image kit for you know image optimizations and code rabbit
44:06
for the AI code reviews. Okay, once again go ahead and sign up, get those free credits, then you know we will fill
44:14
this in in the incoming sections. So I think for now I want to leave it as it is. Here I can say color tells me that
44:21
it has created the plan. MD file everything is separated with a different
44:27
phase and as we built them I think basically it is going to mark it as
44:32
completed just like this. Okay, for now just leave the plan MD as it is. So with
44:40
that said, I think I want to end this section right here where we went through
44:46
the plan mode with cloud. We answered all kinds of questions about this project. We created the plan.md file and
44:54
we created the env file. And we're going to fill this in in the incoming
44:59
sections. So I think for now we can commit our changes and actually
45:06
let's try to push this code to GitHub. What I'll be doing since this is the
45:11
very first commit we don't really need to create a separate branch but for the incoming sections we will create a
45:18
separate branch. Let me actually try to visualize it pretty quickly.
45:24
Okay. So let's say this is our git history right and we are right here initially. This is the initial commit
45:30
but then for every single feature when we want to implement something instead of directly committing it we will create
45:37
a separate branch we are going to implement this and we will ask AI to review it first if it is reviewed like
45:45
if everything is done successfully right so AI will say maybe you should add some
45:51
more features or fix this security issue right so we're going to add more commits
45:56
until we fix it and once this feature is completed only then we are going to push
46:01
it to the actual code to the main branch right so for every single upcoming
46:07
features this will be the workflow that we're going to have once again we will create a separate
46:14
branch add our commit ask AI to review it if it
46:19
passes we are going to push it to right here with a pull request if AI suggests
46:24
some more changes then we'll add new commits and eventually Actually once it is ready then we will send the pull
46:31
request and this is the workflow that you would follow if you are working in a real company right with with some
46:39
teammates. Okay but for the very first commit we don't really need to do it. Um what I'll
46:45
be doing I'm going to go right here let me just try to add everything to the
46:50
staging area and then I'll just get a commit message
46:55
with AI. So, I'm going to press this button. It'll generate the commit message.
47:03
Okay. So, you can read it. I'm just going to skip this. I'm going to say commit. And we would like to push this
47:09
code to GitHub. First, I'll go and visit my GitHub account and create a repo. So,
47:15
once you log into GitHub, just say create new repository. For the name, I'm just going to say triply AI. You can
47:22
really call this anything. Initially, I'm going to leave it as private, but at the time that you are watching this
47:27
video, it's going to be public. And then I'm going to say create the repository.
47:33
Now, this is going to give us some three different commands where we would like to copy this and paste it into our into
47:40
our terminal. This basically says push an existing repository from the command line. So, we have an existing repository
47:48
in our local machine. We'll open up the terminal. Let's clear this up and I'm
47:54
going to run this. Like I'll just paste this in.
48:00
So, this will take every single change like all these files and push them into
48:05
this repo. As you can tell, we just got it. Um, everything is right here. Now, you might
48:12
be asking, we created the mobile app, but we never run it, which is fine. like
48:18
we will have a simulator in the incoming sections and we will actually run it. But as I said before you write a single
48:25
line of code and get into the mobile app first you need to come up with the entire plan. This is the first step of
48:31
the workflow because once you have every single spec that is you know you decide
48:37
them and put it under a file it's going to be very easy to build the app later
48:43
right so I think that's the biggest mistake that I see beginners make they just want to immediately jump into
48:49
coding but dude you don't really have a plan right first you need to decide everything like your text tag your
48:56
features your design once you have everything only then you can jump into
49:01
coding. So AI doesn't really guess anything. This is what we are doing. Hopefully in the next section we're
49:07
going to get into the second step of the workflow. Let's just take a look at it.
49:12
Um it's going to be this one where we will generate the UI design. Again I have bunch of different props sorry
49:19
prompts that I provided. Um once we have the UI design then we will jump into
49:24
coding with AI and we will build everything step by step. So we will start with authentication to the home
49:31
screen to the AI assistant so on and so forth. Okay. So with that said hopefully I'll see you in the next lesson. All
2- UI Design & Auth Screen
49:38
right. So now that we have our plan ready, it is time to get started with the UI design. Now to be able to
49:46
generate the design, we are going to be using some AI tools. In my case, I will be using GPT image, but you can use
49:53
really anything like Gemini or any any kind of other models. I would say GPT
49:59
works really nice and I'm going to show you how to use it as well. But first, here I have a document that I have
50:06
prepared with at the moment three different images and three different prompts. Like if you want to get this UI
50:13
design, then this is going to be the entire prompt. Like you basically design every single screen specifically one by
50:21
one. Then you give the design system, right? Like the typography, color
50:27
palette, the design style itself, components, and the goal of this app as
50:32
well. And then you also give the name of the app. So let's just scroll to the bottom. Then we have a recipe app UI
50:40
prompt. You can take a look at it as well. I'm going to link it in the description. Then we have a dating app
50:47
UI prompt as well. And then the calorie tracker app. That
50:53
was the UI that I you that I used for my own actual application. And it looks
50:58
very very similar. Not exactly the same, but I would say 90% it is the yeah 90%
51:05
similarities. So you can find this link in the description and what you would do
51:10
just copy one of these prompts. Okay. Then you will go into VS Code. Then open
51:16
up cloud or any kind of other agent really. You're going to paste that prompt. Okay,
51:22
for any any of these app, just get one of these prompts and then say depending
51:27
on my plan, generate me a prompt similar to this. So here's the entire prompt.
51:33
You will say, generate me a prompt for UI design image generation for my app based on the plan.md file. And this is
51:41
how we can reference the local files by the way. You'll just say add and then name of the file. So it's going to give
51:48
you the prompt and you will copy it. Then go into GPT
51:53
and then you'll just paste the prompt and you will get an image back. What you can do on top of this prompt is maybe
52:00
say something like the aspect ratio should be 16 to9. So you get this
52:06
horizontal image rather than a vertical one. So that was my first prompt for the
52:12
recipe app. But in our case, we're going to be using the trip planner app. So I'll be using this image as the
52:19
reference for design. And then let's say you want to get the background image for
52:24
the authentication screen, right? How do you get this background image? What I do is basically taking a screenshot of this
52:31
part and then I go into the next chat. I just say generate me this background image so I can use it. no text, you
52:39
know, no logos, nothing. Then I'll get the image. So I can download it, put it
52:45
into a folder, then use it. What I usually do, creating a folder called
52:50
design, then I put all these images into it. And since I already have the design,
52:55
I'll go ahead and copy this image and then just paste it right here. So in your case, what you would like to do if
53:02
you don't really want to use this design, then just go ahead paste your prompt, get the UI design, and then you
53:09
know, just paste it right here. So I'm going to call this app UI design and
53:16
like it doesn't have to be exactly the same. So I'm just going to say something like design example or inspiration.
53:25
Okay, so that's the first thing that we're going to do. And then the other one is getting kind of like a design
53:32
system. So here if I just scroll to the bottom you're going to see something like I said generate an image of design
53:38
system for this application that includes colors, font family, components, etc. And this is what I got.
53:46
So what I'll be doing, I'll just copy this and go right here. Then paste this in. I'm going to say design system.
53:56
Now later in the video whenever we want to build our UI we are going to reference these images so AI can really
54:04
compare our application to these images and make sure we have the exact same UI.
54:09
So now that we have the design system as well as the you know app design let's
54:15
say you would like to start with the welcome screen. What I would do is taking a screenshot of this part. Okay.
54:23
And then I would go into my chat. I would say go ahead and upscale this
54:28
screen. So it's going to upscale it. Right. So I have the entire image with high quality. I would copy it and then
54:35
right here I would paste and then say something like oath UI
54:42
design. Yeah. Let's actually get started with the authentication screen. So,
54:49
we'll be using this design to let Claude, you know, to build the exact same UI for us. And for authentication,
54:56
we are going to be using Clerk. But first, let's go ahead and run this app. So, in my case, I have a simulator which
55:03
is open right next to VS Code. If you don't have a simulator, I would highly recommend you to install one. If you're
55:10
on Mac, you can get iOS. You know, if you're on Windows, you can get Android, which is completely fine. And you can
55:17
even run this app in your actual phone. But first, let me just show you how you can run it on the simulator. So, once
55:24
you have your simulator open, you will go into VS Code, open up your terminal, and you will say something like MPX Expo
55:32
start or just MPXO. This is going to, you know, go ahead and
55:37
try to run the application. So, I'm just going to press I, which stands for the iOS simulator. If you would like to run
55:44
it on Android, you will press A. And if you want to even run it on web, you will press W. In my case, I'll press I. So,
55:53
this is going to go ahead and install the Xogo application into the simulator and then run this app within that. Now
56:01
the other option is installing the XOGO in your actual phone then scanning this
56:07
QR code. So it will basically open this app in
56:12
your actual physical device. But make sure that you are connected to the same Wi-Fi network from both your phone and
56:20
in your laptop. And in this case it is trying to run the
56:26
application. Hopefully we should see something super simple like this is the
56:33
application content.
56:42
Okay. So here you can tell if you edit the screen and save it is going to update the UI automatically. Now of
56:49
course this is super simple. We don't really want to have something like this. Um first I'll go into clerk
56:55
documentation and I'd like to get clerk skills right so this is what you can do
57:02
just type clerk skills and then from here you would like to basically install
57:07
some skills for cloud and if you're wondering what are skills basically they are installable packages that give AI
57:14
coding agents specialized knowledge about clerk so once it is installed our
57:19
agent can help us to add the authentication, manage organizations,
57:25
sync users, and more. Now, if you don't want to do it manually, you can copy this as markdown and go into cloud, you
57:32
know, just say read this and implement me or install me the skills. But in my case, I'm just going to copy the,
57:39
you know, copy the command and not actually here, I'll paste it into a
57:44
terminal.
57:52
Now, here you can select which skills you would like to install. And in my case, I think I'm just going to select
57:58
the core. You press space, by the way, if you want to select anything or deselect anything. Um, so we can just
58:06
scroll to the bottom and we can get the clerk web hooks.
58:11
We can get the clerk expo. I'm just looking at if there is anything we would
58:16
like to get. Let's say clerk expo patterns. Now, let's say you don't really want to
58:21
go this list, right? What I would do, let's actually kill this terminal. I'm going to go ahead open this up on cloud
58:28
and I'm going to say, you know, instead of pasting this, I'm just going to copy this as markdown and I'm going to paste
58:35
this in. And then I'll say install the skills that are needed for this project.
58:47
So Cloud will go ahead and read the skills that you just paste and then it's going to try to install them. But first,
58:53
it's going to ask for permissions. So here in my case, I'm just going to say yes, allow this command for all
59:00
projects. So that in the future, it doesn't really ask me the exact same question. And here I'm going to give the
59:06
permissions. All right. So after some time, cloud is done with it. It says here are all the skills that I have
59:13
installed. It says I skipped the other 17 skills because they don't really
59:19
apply to this project. Okay, so with that said, if you take a look at the
59:24
codebase, you're going to see that now you have a cloud folder. Within this you have skills and within this you have,
59:31
you know, skills for clerk. Later in the video, you can add all kinds of skills.
59:37
I think we will add some more skills um in the incoming sections, but anytime
59:43
you install a skill, it'll go under this folder under the skills. And we also
59:48
have this file which is something that you don't really need to get into. Um so yeah, now with this in mind, there is
59:56
another package that we would like to install which is going to be called as expo dev client. Now you would like to
1:00:03
install this package and let me go ahead and actually show you this.
1:00:09
So this is what we call a development build and you would like to use a
1:00:14
development build anytime you want to build a real world application because this expo go lets you to test simple
1:00:22
apps but if you're building a real application this is not going to be enough okay so this is just for testing
1:00:28
purposes. So when I was building the demo application, I used the development build or when I was building my own real
1:00:36
world project which is bulky AI, I also used a development build. Okay,
1:00:43
because some packages, some native modules don't really work with expo.
1:00:49
Okay, with this in mind, let's go ahead and ask Claude to install the expo dev
1:00:55
client.
1:01:02
Now, you can install it by yourself as well, but really we can just tell cloud to do it because it's something super
1:01:08
simple and there is no way that it's going to fail. Basically, just going to run this
1:01:14
command mpx expo install and then the name of the package. And there is
1:01:20
nothing to set up really once you install it. Then when you run your app
1:01:26
like let's go ahead and kill this here it says you need to run your app
1:01:31
with this command initially and then here I'll just say mpx expo run iOS if
1:01:38
you're on Windows you would say Android so in the first try it's going to take
1:01:43
some time but then it should be like in the next times it should be faster
1:01:50
okay so while this is installing we are going to implement the authentication screen and for this we will have a
1:01:59
workflow. So let me go ahead and show you that. So first off this is what we have done so far. So we've generated the
1:02:05
full UI design. Then we upscaled each screen in this case only authentication
1:02:12
but we're going to upscale every single one of them in the incoming sections and then we're going to build them one by
1:02:18
one. Now we are getting started with the authentication screen which is this one.
1:02:24
Right? So we have the UI design. We upscale it. Now it is time to build it.
1:02:29
And here is the workflow. Now you can use cloud, you can use cursor, you can use anti-gravity winds surf. It could be
1:02:36
really anything. But here we have a builtin verify loop. So first off we are
1:02:41
going to implement the feature or the UI design. Then we will tell Claude to take
1:02:47
a screenshot from the simulator and compare it to the design. If it is
1:02:52
identical then it means sorry if it is identical it means we can move on to the
1:02:58
next feature. But if it is not identical then just keep going and go through this
1:03:03
loop again and again until it is identical. Now most of the time it's not going to be 100% identical. Not really
1:03:11
because it's AI, but I would say um it is mostly around 80 or 90%. And that's
1:03:19
where you can just jump into code and add some modifications or really just be
1:03:24
happy with the end result. Okay, so this is the workflow that we'll go through once again. We're going to first try to
1:03:31
build the feature with cloud. Then we'll say you should take a screenshot compare it to design and go through this until
1:03:39
it is identical. Once it is identical we will go and move on with the next
1:03:45
feature. Okay. So here let me just go ahead and visit cloud. And by the way
1:03:52
from my terminal the development build has failed. I think that's because we don't really have the sentry set up yet.
1:03:59
We're going to get into it in a second, but before we do so, let me just go ahead and try to show you a different
1:04:06
prompt. So, for this workflow, let me show you this. So, for this workflow, I have an extra
1:04:14
prompt. Again, I'm going to link it in the description. So, you can basically copy it, then paste it into cloud. Now,
1:04:22
we'll get into it in a second. There is one more package that I'd like to install, which is going to be native.
1:04:29
Basically, this is a Tailwind but for React Native. And let's say get started.
1:04:35
At the time that I'm recording this video, the version five is in the pre-release. So, I think version 4 is
1:04:43
more stable. So, in this case, I'm just going to go ahead and copy this entire file, paste it into cloud, and I'm going
1:04:50
to say, so on top of documentation, this is what I have just added. You can pause the video and read it. Basically, I said
1:04:57
this is the documentation for native wind. I want you to go ahead and read the
1:05:04
entire documentation from start until the end step by step and implement it correctly in my codebase and then double
1:05:12
check if it has set it up correctly. So here you can tell cloud is trying to
1:05:17
set this up with a list of to-dos. And while this is building it, let's go
1:05:22
ahead and try to set up sentry in our project. So for this head over and log
1:05:28
into your sentry account then select projects. From here we will create a new
1:05:34
project. So in my case I already have bunch of different previous projects but
1:05:40
if you don't have any that's completely fine. We will start from absolute scratch. Now you have the first option
1:05:47
as the platform. In our case we are building a React Native application. So
1:05:52
we're going to select this SDK. Then you can set your alert frequency. You can,
1:05:58
you know, really customize it. As you can tell, there are a bunch of different options, but I'm going to leave it as a
1:06:04
default. Then, you know, by default, you'll be notified via email. But if you
1:06:10
want to set this up, you can really set it up on Slack, Discord, and even
1:06:16
Microsoft Teams. Now, let's create a project slug. In my case, I think I'm
1:06:21
just going to call it as triply tutorial. You can call this anything. Select your
1:06:28
team or organization. I will leave it by default, which is this one. And then I'm
1:06:33
going to say create the project. Now, once you create the project, you're going to get this
1:06:40
um what we call it as let me zoom in so you can see it clearly.
1:06:46
Okay. So let me try to zoom in maybe from here. So here we have what we call
1:06:51
the sentry wizard. Basically it is a CLI tool that automatically sets up sentry
1:06:58
in your project. You can copy this and paste it manually to your codebase or
1:07:03
you can just copy the instructions. So this is the beauty of you know AI age.
1:07:08
Basically on every single documentation we have this button. So we can just copy
1:07:14
all the instructions and paste it to our LLM. So in my case, let me go ahead copy
1:07:20
it, give the access by the way from a different tab. We can paste this in and we can just say
1:07:28
setup sentry in my project. And this is
1:07:34
the documentation. I just paste it above.
1:07:40
All right. So after a couple of seconds here I can see that Sentry has been set it up even though there is something
1:07:45
that we need to add which is the authentication token. I'm going to get into that in a second. But the other
1:07:51
thing is the native wind setup. So this has also been implemented successfully
1:07:57
and here you can tell it is actually working. If you visit the index.ts app
1:08:03
we are using class name which are coming from Tailwind and it is already working. Now in my case something has failed when
1:08:10
I tried to build my app with MPX export run iOS. So I just got this error right.
1:08:17
So I have copied it with a different tab. I just said you know like this is the error that I got. Let me show you
1:08:23
the prompt. So I said I get this error when running MPX runs. What is wrong? Let me know and
1:08:32
also fix the issue. So if you're interested, you should always ask you know what is wrong, let me know, but
1:08:39
also try to fix it. So next time when you get this error, you can automatically know why this is
1:08:45
happening. Okay, so with this in mind, now we need to get the sentry oath token. So basically, you will go into
1:08:52
your sentry dashboard and from the search you can just say oath token and
1:08:58
we're going to get into the organization tokens. In my case, I have bunch of them, but let's create one from scratch.
1:09:05
You can give it a name. In this case, I'll just say triply tutorial. Create the token. Now, once you create it, you
1:09:13
will only see this once, right? So, copy it and paste it into your terminal.
1:09:18
Sorry, not terminal, but file. Let's go ahead. In our case, we have env. And I
1:09:26
think Sentry Wizard created the local file. So instead of putting it here, I'm
1:09:32
going to just put it under the env. So I'm going to paste the value. I'm not going to show you that part. Basically,
1:09:38
I'll pause the video, but what I'll be doing is basically cut it from here.
1:09:43
Paste it right here. And then I'll just get my token from Sentry dashboard. All
1:09:48
right. So I have just pasted that O token into the env file. Now next, we
1:09:54
will go ahead and get the background image for the authentication screen. As you already know, I said go ahead and
1:10:00
generate this background image so I can use it in my app. I'll copy this image.
1:10:06
Go under the design. I'll paste this in. And maybe I'll say something like oath
1:10:12
screen background image.png. Now I'm going to go ahead and get this
1:10:18
prompt. Let me get it from the um from the Google Docs. I'm going to copy it.
1:10:26
So this is basically the prompt that will put Claude into this loop.
1:10:33
Maybe I can close this chat and create a new one. In here I would like to, you
1:10:38
know, reference the oath design.png file.
1:10:45
Okay. So you can read the entire prompt basically like this is what we say, right?
1:10:52
And if you're interested, you can read it from start until the end. Okay. So here I will also make sure that
1:10:58
this is referenced. Now just before we run this there are two different things that I'd like to talk about which are
1:11:05
agents.md and cloud.md file. Now I'll just keep this chat open. So let's close
1:11:12
the other ones. I'll just keep this open but we'll get into this in a couple of
1:11:17
minutes. First, I'd like to talk about cloud.md and agents.md because I want to
1:11:23
set one of these files. So here, let's go back into the diagrams and let's just
1:11:28
first ask what they are. So both are plain markdown instruction files that
1:11:34
get autoloaded into the AI's context at the start of a session. So here when you
1:11:40
go ahead and talk with claude, first what claude does is reading these files,
1:11:45
right? First it gets the context and then it reads what you have added on top of it.
1:11:53
So they are where you put project conventions, architecture notes, things like always do X, never do Y rules, etc.
1:12:02
The difference is just who reads them. So cloud.md is built specifically for
1:12:08
cloud code, but agents.md is you know agent agnostic. So basically all other
1:12:15
AI coding tools can read it. That could be cursor, GitHub copilot, Codex, Gemini
1:12:22
CLI and even cloud code itself. So you might be asking then which one should we
1:12:28
use with cloud? Well, we can just go with agents.md. And in cloud MD, we can
1:12:34
just make one reference to this file. And I think this is how it is seted up
1:12:39
at the moment. If you take a look at the agents.md, we have something like expo
1:12:44
has changed. Read the documentation. This is coming from expo. We didn't really type this out by hand, but here
1:12:51
under the cloud.md, there is a reference to the agents.md file. So basically, it
1:12:57
says to cloud, you should read the agents.md file for this, you know,
1:13:03
initial instructions. So in my case, I would like to build the agents.m MD
1:13:08
where I'd like to add my text stack. You know, on top of it, there is something
1:13:14
called native tabs. So I'd like to just add it as a rule. I'll basically say
1:13:19
every single time you should use the native tabs. And if you don't know already, native tabs are the feature
1:13:26
that will allow us to have this iOS liquid glass effect. You can take a look
1:13:31
at the documentation if you're interested, but we will get into it in the incoming sections. First, what I'd
1:13:38
like to do is building the file content for agent side MD file. Now, you might
1:13:43
be asking, I don't know how to build this file. Like, I don't know what to put inside. What should be the content?
1:13:50
Well, you can just go to cloud and say, depending on my project, what should I
1:13:55
have in agent MD file? Like, should we have the text tag? I want to use native
1:14:01
tabs all the time. Should I include it? Things like that, right? Just let me know. This is exactly what I have done.
1:14:08
And it says what your project actually is. And then it is like it is going to
1:14:13
propose me an agents.md file. So we already had this part. On top of it, it
1:14:19
adds the text stack like export react native, export router, sentry, so on and
1:14:27
so forth. And I think on top of it we can say for database we are using neon
1:14:32
for you know RM we are using drizzle in for background jobs you know clerk for
1:14:39
authentication image kit for image optimizations so on and so forth. I'm going to get into it. Then here we have
1:14:46
some conventions like for styling we are using class name and not really inline
1:14:51
styles. So I think I'm pretty happy with what I have at the moment. I'm gonna say on top of this let me just talk with
1:14:58
cloud. Okay. So on top of this I want you to
1:15:03
update the text stack part. So we want to use Postgress database coming from
1:15:09
neon and we would like to use the result as our RM and we are using let's say we
1:15:17
are using image kit for image optimizations. We are using clerk for authentication. We are using ingest for
1:15:25
background jobs and sentry for error tracking and monitoring. And also other
1:15:32
than text tag, I always want to use native tabs. So I don't really want to
1:15:37
use JavaScript tabs. This project should always have native tabs. With this in
1:15:44
mind, go ahead and build the agent MD file.
1:15:50
Okay, so there are a couple of different typos. Let me go ahead and fix them. So this should be agents.m MDF file. Let's
1:15:56
read it from start until the end. Um here this should be the result.
1:16:04
So we have image kit clerk. This should be inest.
1:16:09
Okay. We have sentry and I think the rest is correct. Now once you create the
1:16:15
agents MD anytime in the future you can update it, right? It is not like you you
1:16:21
will create it once and forget it completely. Well, not really. You create it once and as you have more rules or
1:16:29
you know you have updated your text stack let's say then you would just go ahead and add it into the agents empty
1:16:35
file. Now one of the other things that I want to add I just realized basically I
1:16:41
will tell cloud to never run my application because I am already running it with a separate terminal right so I
1:16:48
never want cloud to start a new session
1:16:53
now I also want you to add this prompt or this you know instruction to the
1:17:00
agents.md where basically you should never ever run the application by
1:17:06
yourself because I am already running it in a separate terminal.
1:17:13
Okay, so this is not the best prompt but I think it should work out. And here you can tell it has added this line. It says
1:17:20
never run the application by yourself. Okay, so that's the general idea of
1:17:26
cloud.md and agents agents.md file. Basically, you build one of them. In
1:17:33
this case, it is best to build agents.mmd because it is really like
1:17:38
agent agnostic. You can use codex, gemini, cloud, doesn't really matter.
1:17:43
And if you're using cloud, just go ahead reference it with this one single line.
1:17:48
It will basically read this file content. Okay. So with this in mind, now we can close this. And this is where we
1:17:55
left. I will go ahead and run this. And let me just at the very end I want to
1:18:01
say something like use the oath screen background image.
1:18:07
So I'll just reference this file. I'll say use this as the demo image for oath
1:18:15
screen just like in the design file.
1:18:20
All right. So this is what claude came up with with the very first try. Now it looks like this is not really identical.
1:18:27
So, it's going to go ahead and do this part again, right? And probably it's going to take couple of times until we
1:18:34
get there. So, I'll just go ahead and give the permissions and let's see how this will end up. All right. So, as you
1:18:41
can tell, it is just keeps getting better. And here it says like it just gives a kind of like feedback to itself.
1:18:48
It says the screen rendered, but the button backgrounds and layout are missing. So, like it just give itself a
1:18:55
feedback. Now we're just trying to build it and just make sure that it looks like the end result.
1:19:02
So here is another feedback that cloud gives itself after taking a look at the
1:19:07
screenshot. So basically this was three lines. So here it says it is wrapping to
1:19:13
three lines. Let me go ahead and make sure that it is only two lines just like
1:19:18
in the end result. So now it's been fixed as well. But I think this is still
1:19:24
like keep going. All right. Right. So, this has been completed. As you can tell, it is very, very similar. Now, as
1:19:30
I said before, you are not going to get 100% identical end result, but as you
1:19:36
can tell, it's very, very similar. Now, what I'd like to do is actually getting
1:19:41
rid of this kind of like description or this small text and get rid of the email
1:19:46
option. So, it is just my preference. If you wanted to, you can still keep it, but I'll just go ahead and say from the
1:19:54
authentication screen, I want to remove the email option. So, there should be
1:19:59
only two buttons, which are Google and Apple. Leave them as they are, but
1:20:05
remove the email button. And also remove the text that says let AI build the
1:20:11
perfect trip for you. All right, so looks like this has also
1:20:16
been implemented. We get rid of that email button as well as the text. Now, I
1:20:22
think I'm pretty happy with this end result, but if I was building it as a real project, I would ask for some more
1:20:28
modifications. But since this is a tutorial, I don't really want to waste two more hours just to make this
1:20:35
authentication screen look better. I'm just trying to show you the workflow. We're just kind of like putting this AI
1:20:42
into loop until we get the identical end result. And I think what we have is
1:20:48
already looking pretty great. Okay. So with that in mind now we can go ahead
1:20:54
and ask cloud to implement the Google and Apple authentications or you know
1:20:59
when we press them it should work out. So for this first off we need to visit clerk dashboard. Go ahead and login and
1:21:06
then press the create application button or visit this endpoint or this URL. And
1:21:13
then here let's give it a name. I'll just call it as triply tutorial.
1:21:19
And then for the options, I'm going to disable email. I'm going to include Google and GitHub. Now, if you wanted
1:21:26
to, you can add more options. And actually, not GitHub. Wait, it should be Apple. If you wanted to, you can add
1:21:33
more options, but if you're on the free plan, you can only get three um
1:21:39
providers for free. In our case, two is enough like Google and Apple. I'll just
1:21:45
give it a name and then I'll say create the application.
1:21:52
Okay. So again here you will get the instructions for your AI um for your AI
1:21:58
agent. Here I'll just copy the prompt. I think this like this is just for testing
1:22:05
purposes, right? This is going to set this up without your environment variables. But instead of doing it in
1:22:11
this way, let's actually go ahead and visit the quick start documentation.
1:22:16
Let's select expo and then from here I'll just get my
1:22:22
environment variables. So from here select your application. Okay. So just copy it. Go into env.
1:22:31
I'm going to pause the video but I will basically add it right here. Okay. So I have added that value into myv file.
1:22:38
Now, I'll just go ahead copy this entire file or actually we don't really need to because we have these skills. So, I'm
1:22:46
just going to say I have the environment variables for clerk. I want you to go ahead and
1:22:52
implement Google and Apple authentication in my codebase. Make sure to read the skills so you don't really
1:22:59
make any mistakes. and you should follow the skills since they are the official
1:23:06
yeah official documentation. All right, so looks like CLA has
1:23:11
implemented it. I'll go ahead and test out both of these options starting with Google.
1:23:17
Now here I have already logged in with a different account in the simulator in the past. That's why I can see this
1:23:24
account. But if you have never logged in then this will be the UI that you're
1:23:29
going to see. So go ahead and put your email and password. Then you will be able to login.
1:23:36
So I'll just try to select this account and I'll say continue.
1:23:41
Okay. So here we can tell we are redirected to the home screen where user is authenticated. We can see the first
1:23:47
name as well as the email. Now we also have a sign up button. Let's test this out. If I press that now we are
1:23:55
redirected to the authentication screen. And you can double check if everything is working by going into clerk
1:24:01
dashboard. Select your project and under the overview you're going to see this user which is the signed up account. So
1:24:08
that means everything is working end to end. You can also test out the Apple option. In this case I'm not going to be
1:24:14
doing it but I am pretty sure that this is already working here. You can tell you'll just put your email in this case
1:24:21
your probably iCloud account then your password. then you should be logging in,
1:24:27
right? You should be logged in. But in this case, um I'll just skip that. Like I'm pretty sure that it is already
1:24:33
working because they both use the same method which is use SSO hook. Okay. So
1:24:41
everything is coming from the cloud skills like from clerk skills. So just
1:24:47
in case if it fails you can always add a follow-up like take a screenshot put it
1:24:53
into cloud and say you know Google authentication is already working but I don't know what is wrong with Apple then
1:24:59
it should be able to fix it for you. Okay so with this I think I'm pretty happy with the authentication section
1:25:05
like everything is working. I like the UI and um I think it is time to kind of
1:25:10
like commit our changes. Now if you remember in our workflow in our workflow
1:25:16
once we build a feature first we'd like to test out manually which is what we have just done but after that we would
1:25:23
like to run an AI code review so that it can fix any kind of issues if we have
1:25:29
and if we don't really have any issues we are going to save the progress and go to the next feature but if you have kind
1:25:35
of like an issue or problem then we're going to go through this loop. Okay, now it is time to implement this one. So for
1:25:42
this we will go into VS code. Let me go actually um yeah I'll just kill the cloud
1:25:49
instance and let me shrink everything. I'm going to press command shiftp and get the status bar visibility. Now let
1:25:57
me maximize the screen. From here I would like to create a new branch. Okay.
1:26:02
So I'm going to say create new branch. For the name I think I can just say authentication.
1:26:09
So this branch has been created and from here we would like to add everything to
1:26:14
the staging area. So here I'm going to say stage everything. Let's get a commit
1:26:20
message. So AI will generate the message and
1:26:28
while this is generating let me try to visualize what we are doing. So basically
1:26:34
like this is our commit history right and we were right here then we just created a new branch like we added a new
1:26:41
feature but instead of committing it right here what we have done is creating a new branch and here we'll try to run a
1:26:48
code review if it passes only then we are going to merge this pull request
1:26:54
okay so this is exactly what we are doing we'll say commit this and publish this branch and then if you go into
1:27:01
source code. Let's actually visit that. This was called triply AI. You're going
1:27:07
to see something like there is a pull request. So we'll say compare and create the pull request.
1:27:17
All right. So after a couple of seconds, you're going to see something like code rabbit is trying to review your code or
1:27:23
the pull request that you just created. This is at least what I see in my case. If you cannot see something like this,
1:27:30
that means you don't really have code rabbit set it up in your project. So, what we would like to do is going into
1:27:37
codrabbit.ai. I'm going to leave the link in the description. You can get a free plan and then we'll try to log in.
1:27:44
So, in my case, I'll go ahead and sign up or login with my GitHub account. So,
1:27:49
once you are logged in, you will be in the Code Rabbit dashboard. From here, select the repositories and then press
1:27:56
this button where you can add the current repository to the list. What
1:28:01
this does is basically it says to code rabbit, hey, I give you the access where
1:28:06
you can give me a code review in this specific repo. Okay. And once you have
1:28:11
done this in your next pull requests, you're going to get a code review from
1:28:17
code rabbit automatically. So initially like this is going to take a couple of minutes because currently what is
1:28:24
happening is that code rabbit goes through every single file that you just
1:28:29
have as a change right like in our case we have 43 different files that has been
1:28:35
changed so rebbit will kind of like scan it and run bunch of different audits on
1:28:41
it so that it can give us a feedback once it is done I'll just be right back and here you can tell we also have a
1:28:48
summary by code rabbit which is really really cool if you're working with a team. So all of your teammates can just
1:28:55
go into this specific pull request and then see what you have done in this
1:29:00
specific commit. All right. So after a couple of minutes you're going to get the suggestions and comments from code
1:29:06
rabbit. Now we can scroll through it and see every single change or the suggestion really. Well, in this case, I
1:29:14
can see it says something related to skills, which is something that I wouldn't really update because if you
1:29:21
remember, we didn't really build the skills by hand or with AI. These are the
1:29:26
things that we just got from clerk documentation, right? So, these are the things that I wouldn't really
1:29:33
um update. So, in this case, I'm just going to skip them. Let's find a file that is, you know, that is one of the
1:29:40
files that we actually built like global.css. Here it says, you know, here is my fix.
1:29:46
If you don't want to type it out by hand, you can basically get the prompt for AI agents. So, I'm going to skip
1:29:53
this, but let's find a different issue like under the layout file which is
1:29:59
related to sentry. Here it says verify each finding against current code. Fix
1:30:05
only still valid issues. Skip the rest with a brief reason. Okay, so I think
1:30:11
I'm going to skip this. Let's just find something that I actually want to update.
1:30:19
Okay, so I think this is something that I want to copy and just show you how how would I fix it with cloud. So here you
1:30:27
can tell some of the values are 0.1 and some of the values are 1.0. So basically
1:30:34
in production these values should not be 1.0. This is only for development. Here it
1:30:41
says capture all traces in development. But tune this down in production. So I'm
1:30:46
going to copy this and paste it into cloud. Maybe it can run some kind of an
1:30:52
if check and it would make this value to be conditional.
1:30:59
Okay. So I'll just go ahead and paste this in. And by the way, I have the plan.md file open. I'll get into it in a
1:31:05
second. For now, let's try to run it. And let's just see what's going to happen. So just like what I have
1:31:12
explained, cloud has added this conditional check and depending on the
1:31:17
environment, it's going to update this value. So this is how we can run a code review and find some actual issues in
1:31:24
your codebase. So initially before using code rabbit clock code was not really
1:31:30
able to find this issue right so like you have to tell it manually and that's
1:31:36
the beauty of using code rabbit so in this case what I'll be doing like this has already been implemented so we just
1:31:43
need to add this as a commit so I'm going to say stage this get a commit message then we are going to commit this
1:31:51
notice how it is still under the same branch
1:31:56
And then we'll just say sync this up. Basically take this change and send it
1:32:01
into this pull request. So initially we had only one commit. If I reload now we
1:32:07
should have two commits as you can tell. Okay. So I'm not going to go and read
1:32:14
every single one of these because this is a tutorial. I don't really want to make this to be something like 10 hours.
1:32:20
But you get the point. Anytime you find a major issue or even for minor issues,
1:32:26
you would just get the prompt and go into cloud, fix it, then commit the change and eventually you'll just scroll
1:32:33
to the bottom and you will say merge this pull request. And I'm just going to say confirm this merge.
1:32:41
Okay, so it has been merged successfully. Now we can go into our codebase and we can switch to the master
1:32:48
branch. And then we'll just press this button like before I press that. Notice
1:32:53
how we have the old version. So once you press this going to get the latest
1:32:59
changes and put it into your codebase. Okay. So with that said there is one more thing before I end this section.
1:33:06
Basically in our plan MD we have built some of these features but we don't
1:33:11
really updated updated this file at all. So for now we have implemented some part
1:33:17
of oath and some part of it is missing and let me try to explain and then we'll
1:33:22
get get into this file in a second. Sorry. Okay. So here we have the user
1:33:28
who just signed up via clerk and this user is stored in the clerk dashboard
1:33:34
but we will also have a database right. So how do we take the user and save it
1:33:39
into the database as well right? because otherwise it would only be here. Well,
1:33:46
the solution for this is web hooks. Now, if you don't know already what web hooks are, let me try to explain and visualize
1:33:53
it. So, they are some automated messages that are sent when something happens.
1:33:58
And in this case, that something is when a user created or a user account
1:34:03
deleted. So, basically user will sign up with clerk and that user account will be
1:34:10
saved in clerk dashboard. But we also want to take it and save it to our
1:34:15
database. So we're going to set this up with web hooks. Basically clerk will say, "Hey, here's an event where a user
1:34:23
just been created, right? So it is called user.created or a user account has been deleted
1:34:34
and we also have user.updated. So, we're going to listen for all these
1:34:40
events and depending on the event, we will either create the user in the database or delete them or update them.
1:34:47
Okay? So, I hope this gives you kind of like an idea. I know that this is not the best explanation, but we're going to
1:34:54
get there. For now, I just want you to understand that web hooks are some automated messages that are sent when
1:35:01
something happens. And here is the workflow that we're going to set up to sync the user from clerk to neon. Now,
1:35:09
we will get into it in the incoming sections, but for now, let me just pretty quickly go over it. So, we have
1:35:14
the user who is going to sign up with clerk and clerk will send an event to
1:35:20
our API route. And then once we verify this, in is going to run a background
1:35:25
job. So, we can call this really anything. In my case, I call it as sync user. And this will run a simple
1:35:33
mutation that will take the user and upset obsert it or insert it to our
1:35:39
database. Now with that said, let's go ahead and try to update our plan. MD file by talking to cloud. So in my plan
1:35:47
MD file in phase 0 and in phase 1, there are some stuff that we have already
1:35:53
implemented, but we didn't really update that part in the plan. MD file. So I
1:35:59
want you to go ahead and update those parts. So basically we already implemented the authentication for
1:36:06
Google and Apple. We put them under a single page which is I'm currently happy
1:36:11
with it is under the oath screen. And by the way this is the screen that I'm talking about. So here I'll just go
1:36:18
ahead and continue. Now when it comes to the environment
1:36:24
variables just assume that I have already set them up. So we have all the
1:36:29
values in the env file and yeah so with this in mind go ahead and update the
1:36:36
plan.md file. I will implement the user synchronization with inest in the
1:36:42
incoming minutes. So for now just don't really update it. Don't really update
1:36:48
that part. All right so cloud has marked the things
1:36:53
that we have already implemented. So for now I think we can commit this file or leave it as it is. In this case I'll
1:37:01
just make sure that I am under the master branch. I don't really need to create a separate pull request for this.
1:37:08
Um I'll just create a commit message and commit this into the master because for
1:37:13
this there is nothing to really show you here. I'll just say sync this up.
1:37:19
Okay. So that was it for this section. Hopefully in the next one we are going to handle the user synchronization with
1:37:26
inest and clerk web hooks. All right. So now it is time to get
3- Implementing Webhooks & Background Jobs
1:37:31
started with the user synchronization. So this is something that we talked in the past. Basically we are going to get
1:37:37
the user from clerk and save it to our database. And it sounds kind of like
1:37:42
complicated but I'm just going to show you the workflow. It's actually easier than you think. There are just couple of
1:37:48
different steps that we need to follow step by step. Okay. So first off I want to show you couple of different tools.
1:37:55
So the first one is going to be angrog. We will be using it. It's completely free to get started with. So this will
1:38:02
basically give us a production ready URL for our API. So as if we are not running
1:38:07
it in development but as if it is running on production and you're going to see why we will need it. Then on top
1:38:14
of this we have contact 7 which is one of the best tools really out there. So
1:38:20
this is going to give our AI agent or the LLM upto-date documentation. So here
1:38:26
there are basically all kinds of documentations for any kind of tool and it is always getting updated and if you
1:38:33
don't know how to set it up like you can just go into cloud open up a new chat or
1:38:39
if you're using cursor Gemini really anything just say I want you to set up
1:38:45
me contact 7 okay so just say contact 7 by up stash just say like I want you to
1:38:52
set it up in my laptop for every single project. It is just going to set it up.
1:38:58
It is like it is pretty simple and in my case I already have this set it up. So
1:39:04
I'll show you how to use it as well. Basically you put your prompt and at the very end you just say use context 7 and
1:39:13
this will just read the documentation for the tool that you're using. So it's
1:39:18
going to get the upto-date documentation. I hope that makes sense.
1:39:24
Okay. So with this in mind, let's try to kind of like paste a prompt so that
1:39:30
Claude can implement this workflow. I have already prepared the prompt and you
1:39:36
can find it under this file and I already link this in the description. So
1:39:41
just go ahead and copy this part and I want you to pause the video and read this part. Let me just paste it right
1:39:48
here and I'll just maximize the screen. So
1:39:53
here I basically say this is your task and just imagine as if I have the database URL but I actually don't have
1:40:00
it like I didn't really set this up. It is equal to undefined. So we will go ahead and get the database URL from our
1:40:08
neon dashboard. So once you are logged in go ahead and create a new project and
1:40:14
you can find the link in the description by the way. Here I'll just say project name could be triply tutorial. So in my
1:40:21
case I already have one called triply dev. This is for testing purposes but
1:40:27
this will be the production one. Okay. So I'll just say triply tutorial and then I'll just say create
1:40:34
the project. Then we can go under the connect. Let me find it. Okay. So just
1:40:40
press this button and under the env copy this value without the quotes. Okay.
1:40:46
Only get the value. Don't include the quotes. just copy it and paste it into yourv file. I'll pause the video and
1:40:54
paste this in and then I'll just be right back. So I have just paste that value in into myv file. And then here I
1:41:00
say for inest we're going to be using the development mode for now. So I don't really think about the production key
1:41:07
because initially I just want to make this feature work. Once I'm ready to go into production only then I can
1:41:14
implement this part which will be a lot more convenient. And then at the very end I say for the web hook URL I'll be
1:41:21
using angrog and I'm going to provide it to you in a couple of minutes right when
1:41:26
it is needed. So with this in mind I'll go ahead and run this. Now while this is
1:41:32
creating it in the background we'll go into the clerk dashboard under the configure make sure that you select your
1:41:38
project. By the way, under the developers, you will press to the web
1:41:43
hooks link and then here we will add an endpoint. So here I'll just press this
1:41:49
button and here you can tell it says you need to put an actual URL, right? And we
1:41:54
are going to get this URL from Angro. So in the free plan they give you one URL
1:42:00
that you can use. So we'll just say login. I already have a project. So in
1:42:05
my case, sorry, I already have an account. Um, in my case, I'll go under the domains and I'll try to copy this
1:42:11
one. Okay, let me actually just go back under the endpoints. I'll try to copy
1:42:18
it. And then I'll just go right here, paste this in, and at the very end I'm
1:42:24
going to have / API slash web hooks / clerk. So, this is the kind of like
1:42:31
convention. You can't really put anything here, but this indicates that we are going to have it under our clerk
1:42:38
web hook API endpoint. And then when it comes to the events that we will be
1:42:43
subscribing to, it'll be related to user. So usercreated, deleted, and
1:42:49
updated. Remember that these are the events that I just told previously. Okay. So we'll just listen for them and
1:42:57
then we'll say create the endpoint. Then here we will get a signing secret.
1:43:03
So I would like to copy this value and then we will paste it into file. So if
1:43:09
you take a look at thev example, we have cler web hook signin secret. So it is
1:43:15
this key. Now I'll just paste it into myv file and then I'll just be right back. Also I'll give the permission to
1:43:22
cloud. Now while this is getting implemented we can go ahead and visit our injest dashboard. Once again, I'll
1:43:28
leave the link in the description. You would like to basically go ahead and sign in. In my case, I believe I have
1:43:35
already signed in. So, let me just wait for this to load
1:43:40
the dashboard. In production, you are going to need two different keys. So, first let me try to sign in with my
1:43:47
GitHub account. But in development, you don't really need a key.
1:43:54
Um here let's try to find the key section. So you have a sign in key and an event
1:44:01
key. You would like to copy these values and put it into yourv file. So here
1:44:07
let's go under thev example file
1:44:12
like in development you need to have this file sorry this value. So just copy
1:44:17
it and paste it under the env. But in production you would need something like
1:44:23
ingest let's say sign in key and you will have your value coming from the
1:44:30
dashboard and then you would like to also have the event key. So here I'll
1:44:35
just say ingest_vent key and then again you would get this value from the dashboard. So in our case
1:44:43
since we are just trying to build this app in development we don't really need them at the moment but I'll just leave
1:44:49
it under the MV.ample file. All right. So looks like cloud is done with it. And
1:44:55
now it is time to test this out. And here are the things that we need to do step by step. And by the way here I just
1:45:01
followed up. I said is it done yet? Because in my case it took around like 10 minutes. I think my internet
1:45:08
connection was pretty slow. So it was installing bunch of different packages and yeah that was the followup I have
1:45:15
done. Okay. So with this let's try to test this out. It says you need to start the inest server. So I'm going to copy
1:45:22
it and I'll go into my terminal. So I'm going to copy this prompt which is like
1:45:28
mpm runingest or the command and I'm going to run it. So this is going to run
1:45:34
the ingest dev server in our local machine. And by the way, in my case in
1:45:40
the database, Claude has created the users table with all these fields. So in
1:45:45
your case, probably you will have the exact same stuff so that we can take the
1:45:51
user from clerk and save it into our database.
1:45:56
So here I'll just press enter and then I'm going to copy this URL. Once it is started, we can visit it in our web
1:46:03
browser. So I think it's going to be this one. I'll just copy it. go right
1:46:08
here and then I will paste this in. Hopefully, we shouldn't really have any errors, but looks like I have one. Let's
1:46:15
see what's the problem. So, I have just paused the video and try to find the solution. And turns out all you need to
1:46:22
do is basically restarting your Expo application. So, just go ahead stop your
1:46:28
terminal and then run MPX Expo start with the clear flag. So this is going to
1:46:34
basically clear the cache and then everything should work out. In the second terminal make sure to have inest
1:46:40
up and running. Okay. So basically now we have a method where we can create the
1:46:46
user and you can press this view functions button and then you'll be able to see the methods that you have. So
1:46:54
what I'll be doing I'll go into clerk under the users. I'm going to delete this user and then we'll try to sign up
1:47:01
from scratch. So once we sign up clerk will send the user created event right.
1:47:07
So just like here once we sign up this event will be fired and then inest will
1:47:13
try to save the user to our database. Okay so let's just put them side by
1:47:19
side. We don't really have any users not in the database and not even in the
1:47:25
clerk dashboard. Let's try to sign up.
1:47:38
Okay, so I think the sign up process is done on clerk side. We should be able to
1:47:43
see the user right here. And then if we go into our database and reload it under
1:47:49
the users table, as you can tell, we can see that this user has been also created. So that means this workflow
1:47:56
that we just set it up is working correctly. Now, we can jump into coding and really read every single line of
1:48:03
code that AI has generated. But as you already know, the point of this course
1:48:08
is showing you all the workflows that you would need in your future projects. So, I'm not going to go ahead and, you
1:48:15
know, walk you through every single file, but instead I'll just share the workflow with you. Now what I'll be
1:48:21
doing I'll just open up a new clot chat and then I'm going to say you know on top of this user created event I want
1:48:29
you to handle the user updated and user deleted events right because like what
1:48:34
happens if you delete the user from clerk dashboard we want this account to be deleted from the users table as well
1:48:42
okay so I'll go ahead maybe maximize this so in my project I have already
1:48:50
implemented inest by creating the user. So basically when user signs up with
1:48:55
clerk we are taking that user and saving it into our database. In the exact same
1:49:01
way I want you to implement the user deletion and the user.updated event.
1:49:08
So go ahead and implement it and then update the plan.md file.
1:49:14
So basically I want you to mark the things that we done as completed.
1:49:22
Okay. So this is my prompt. Again, not the best prompt, not the best English grammar, but I think that's fine. CL
1:49:29
will be able to understand it. And I'll just be right back once this is done. Then we will test this out. So looks
1:49:35
like this has also been implemented. So let's go ahead and test this out. I'll visit my clerk dashboard and I'll try to
1:49:42
delete the user. And actually before we delete it, let's go into our ingest server or the development server. Under
1:49:50
the functions, if you reload, you're going to see that we got two different methods. And anytime they run, you'll be
1:49:57
able to see them under the runs section. So previously the user.created run. Now
1:50:04
let's try to delete this user. So once this user deleted from clerk
1:50:11
we will have a new run as you can tell running and now it's completed. That means this user is also deleted from the
1:50:19
database. If you reload you're going to see that it is gone. So with that said I'm not going to test out the update
1:50:25
endpoint which is this one. But I'm pretty sure it is also working. And if you're interested in the code part
1:50:32
basically it is right here under the functions. We have three different methods. So this is to create the user,
1:50:41
this is to update it and this is for the deletion. I think later in the video we
1:50:47
are going to test out the user update method. So I'll just leave it for the
1:50:53
incoming sections to test this out. So I think we are almost done with this section. Just before we end it, I'll
1:50:59
just go into cloud and then I'll say check the plan.md file and see if we
1:51:04
have anything implemented but we forgot to mark it as completed. If there are
1:51:09
any, you should mark those as completed. So it turns out there were six different
1:51:15
things that we have already done with but we didn't really mark it as completed. This is what clot has
1:51:22
implemented and I think this is a like this is a nice way to keep track of the
1:51:27
features that you have already implemented. That's why in my workflow I always just let cloud to you know mark
1:51:34
the things that I am already done with. Okay. So with this I think we can create
1:51:40
a new branch and commit our changes. So I'll just say command shiftp.
1:51:46
Um, instead of saying reload the window, I should say toggle status bar visibility.
1:51:52
So, what is going on? Let me just close this. I'll say don't save.
1:51:58
Okay, from here I'll try to create a new branch. For the name, I think we can
1:52:03
just say oath db sync and then let's try to commit everything.
1:52:14
So, that's my commit message. I'll say publish this branch. Then we'll go into our codebase
1:52:20
or the repository. Then we will create the pull request.
1:52:27
Like here you can see all the changes that we have done in this pull request.
1:52:32
So we have like 12,000 lines which is insane. And we have deleted seven lines
1:52:38
in this pull request. So as you can imagine it's going to take some time for code rabbit to analyze it and come up
1:52:46
with a review. So here you should be you know patient and just wait for the
1:52:51
suggestions that will be coming from code rabbit. Once we got them I'll just be right back. So after some time as
1:52:58
usual we got the summary of this pull request that you can take a look at and
1:53:04
we also have the walk through with every single file that has been updated and
1:53:09
you know the changes kind of like a summary. Then you even have like a sequence diagram. You can take a look at
1:53:16
them but I'll just try to see the suggestions that I have. So I think I can shrink this. And there is also this
1:53:24
feature where it says review the change stack. So you can press that. This will
1:53:29
take you to the, you know, change stack and you can kind of see the changes side
1:53:35
by side. Now at the time that I'm recording this video, this feature is in preview. They are actively improving it.
1:53:41
You can give it a feedback after testing this out. Basically, you have all the files like previously we didn't had it.
1:53:48
But with this pull request, this is the change that we have done. like we have added this file. Same for the DB index
1:53:55
file and you can scroll through it and see every single change that you have in this in this pull request. You can see
1:54:02
everything under the files or if you're interested in layers, you can select the
1:54:07
layers. So with this, I'll just go back to my poll request. I think I cannot go
1:54:13
in this way. I'll just find the repo itself under the pull requests. So this
1:54:20
is the current one that we had and I'll just scroll to the bottom. I'll
1:54:26
try to find the suggestions. So this is a minor one. It says maybe you should add the actual value to the to the env
1:54:33
file instead of putting the without any values. But since we are not going to deploy this app to the app store, I
1:54:40
think it is completely fine to leave it in the development. And then let's scroll to the bottom here. It says you
1:54:46
can maybe update this clerk API endpoint. It is minor so I'm going to
1:54:51
skip this as well. Then we have a major suggestion or like a let me zoom in like
1:54:59
a major problem that we need to fix. It says don't really put the isdev as
1:55:04
hardcoded but as I said we are not going to deploy this. So I'll just leave it as true. But if you wanted to like you can
1:55:13
copy the prompt and go into cloud you know just ask it to implement it for you. This is something that we have done
1:55:19
in the past. But for now I'll just say merge the pull request. Let's confirm the merge. Once this is
1:55:26
done successfully I'll go back into VS Code. Let's switch into the master
1:55:32
branch and then I'll just press this button to sync this up.
1:55:39
Okay. So with this now we have authentication and synchronization working successfully. In the next
1:55:46
section we can get started with the actual home screen and we're going to have our native tabs. So in total we we
1:55:53
will have four different tabs which are home assistant trips and profile. So
1:55:59
I'll see you in the next lesson. All right. So this is where we left in this section. We are going to get started
4- Native Tabs & Home Screen & Trip Generation
1:56:05
with the native tabs. So, we're going to basically update this home screen that we currently see. And off camera, I have
1:56:12
got bunch of different images. Let me show you them. If you wanted to, you can grab them from the source code. And I'll
1:56:19
show you how I generated all these images step by step. Okay. So, first off, let's say like I just want to show
1:56:26
you a trick. Let's say from the app UI design, I like one of these screens.
1:56:32
Let's say this one, but I want to see a different variation of it. Like I like this one, but not entirely. So I would
1:56:40
take a screenshot and then I would go into GPT. Then I would say generate me a
1:56:45
grid of nine images of different UI for this screen. So and I would just say like improve it and then I would get
1:56:52
nine different variations of it. So let me try to maximize it. Like I don't know
1:56:58
why it doesn't maximize but here we go. So we got nine different variations and
1:57:03
from one of them you're going to like one of them, right? So in this case I like this one. I take the screenshot and
1:57:10
then I said generate me this background image so that I can use it. And here you
1:57:16
can tell I got the image but then I also said make the background to be transparent so I can use it in my
1:57:22
application. And here is that image. So basically we are going to be using it on
1:57:29
the trip loading screen. So this is how I create different variations for
1:57:34
different screens and then I pick one that I like. So I think I've did it for
1:57:40
the trip detail page as well. This is what I have built initially but I didn't really like it like something is off
1:57:46
right here. So I took the screenshot and and then I said like do the same thing
1:57:51
and then here I got nine different variations.
1:57:57
It is this one. So from here I just selected this one. I think I like this more even though this one is also
1:58:04
looking really nice. Um yeah. So I just said like upscale the sixth one which is
1:58:11
this one. And then I took this image, paste it into my design folder, and then
1:58:17
I asked Claude to go through that loop until I get the exact same end result.
1:58:22
So in your case, you can follow along with this exact same style. But in my case, I'll have it a bit different. Like
1:58:28
this will be the assistant UI. This is going to be the home screen UI and you
1:58:34
know, profile screen as well as the trips screen. Then I also have this
1:58:39
world image. Again, let me show you how I generated that. Basically, here I said
1:58:44
give me six different variations or even nine. Initially, this is how it would
1:58:49
look like. And then from one of them, I selected this one. I said, you know,
1:58:55
upscale it. So, you got the point at this at this point. Um, yeah, I would just grab the images so that I can use
1:59:03
them in my codebase. So here eventually GPD give me this one and then I paste it
1:59:08
into cloud and then I go through and try to build this you know build this UI. So
1:59:14
this is what we'll try to do here. I'll go ahead and open up a new cloud instance and we would like to use a
1:59:21
native tabs for this. I'll go ahead and open up the native tabs documentation
1:59:27
from expo. So I will basically copy the entire page just to give it as a context
1:59:32
to the cloud and then I'll say go ahead and implement me the native tabs on the
1:59:37
yeah in my application. So here's my prompt. I just talked with the cloud. I said I have just pasted the
1:59:43
documentation of native tabs which is right here. So I paste it below to it and then I said go ahead and implement
1:59:50
it in my application. I want to have four different tabs which are home, assistant, trips and profile. And then I
1:59:57
said we'd like to get started with the home screen UI design. And then I said first we'd like to build the UI not
2:00:03
really any functionality. You know later we will make it actually work. And I said for the UI design you can you know
2:00:11
take a look at this image which is this one. So I have referenced it and I also
2:00:17
said you can use the world.png and then I also said put yourself into that
2:00:22
previous loop that we have done. Basically, it's going to take a screenshot from the simulator and then
2:00:27
compare it to the design until it is identical. Right? So, I'll go ahead and run this and I'll just be right back
2:00:35
once this is done. And actually, while this is getting generated, I have a logo.png as well as the AI logo. And let
2:00:42
me show you how I have created them. Basically, within the same chat, I say
2:00:48
generate a grid of nine logos for this application. But I didn't really like this uh kind of like plain. So I just
2:00:56
said something different than this one. Then here are some other options. And
2:01:01
then I said maybe a world icon because I didn't really like any of them. And from here I like this one. So I take the
2:01:08
screenshot. I said upscale this without the text and it should be transparent background. So this is exactly what I
2:01:15
have done. I copied the image, paste it into my codebase. And then I did the exact same thing for you know like here
2:01:23
I said generate a grid of icons for this AI button at the bottom. It'll be like a
2:01:29
chatbot and from here I like this one. You know you you know the trick already.
2:01:35
You take the screenshot and say upscale this for me without any transparent background. All right. So here you can
2:01:41
tell this is the very first variation that we got from cloud. It looks almost identical to what we have in these
2:01:48
screenshots. But here I think I need to follow up once this is completed. I'll say take this image and put it on the
2:01:55
very right hand side. But I think it is already doing it like it is taking the screenshot from simulator and then it is
2:02:02
comparing it to the you know to this page or to this file. So as you can tell
2:02:10
we are getting there. First off it kind of like give the spacing. Now I believe
2:02:15
at this point it is going to make it a bit larger and put it on the right hand side. Okay. So as you can tell cloud is
2:02:22
done with it. Even though it is not 100% identical you know I'm still very very
2:02:28
happy with what it came up with. So first off I'm going to have two different follow-ups for the
2:02:34
improvements. The first one I'd like to take this image make it a bit larger and put it on the right hand side. And the
2:02:40
other one is giving some extra spaces when I scroll so that this doesn't really overlap with the images. Right?
2:02:48
So I'm going to go ahead and explain this to Cloud. So overall, I like the
2:02:54
home screen UI design, but I will ask for two different improvements. I want
2:02:59
you to take the world.png and make it a bit larger and put it on the right hand
2:03:05
side. So it it should sticky it should be sticky to the right hand side of the
2:03:11
blue box and at the very end of this page in the home screen when we scroll
2:03:16
there should be some extra spacing so that the native tabs are not really
2:03:22
overlapping with the popular destination images.
2:03:29
So here I follow up couple of different times. Eventually the image is bigger
2:03:34
but now it cannot really push it to the right hand side. So this is where you would like to jump into code and fix it
2:03:40
manually. So here I can tell under the index.tsx like it is this part on the right hand
2:03:46
side. I'll say something like let's make it like 52. Okay. As you can tell I
2:03:52
think I'm happy with this. You can update the value to be something like 48 45.
2:03:58
Yeah, I think I'll just go with 58. Just like this.
2:04:04
So other than this, I think I'm pretty happy with the end result of how home
2:04:09
screen look. We even got the extra spacing at the bottom. Now these are
2:04:15
some hard-coded data which is fine. We are going to fix them. But for now, let's try to build the get started
2:04:21
screen. So when we press this link, we should be able to see these pages.
2:04:29
like the UI should look like this. And I got both of these images like design one
2:04:35
and design two because if you scroll to the bottom, this is the rest of it.
2:04:40
Okay, so basically both of them are a single screen and I'll just explain this
2:04:45
to Cloud. So here's my prompt. I basically said go ahead and take these
2:04:50
images as a reference and then build the UI design. For now, make the UI work.
2:04:56
Later, I'll ask you to implement the functionality. So, I'm going to run this and we will be
2:05:02
redirected to this screen when we press this get started button. So, looks like
2:05:07
it is done. Let's go ahead and test this out. As you can tell, we have the exact same screen. It looks a little bit
2:05:14
different, but I think it's not that of a big deal. So, one thing that I'd like
2:05:19
to add is selecting the current date. So, today is July 1st. Basically, I
2:05:25
wanted to make the previous dates to be disabled. I think it is already implemented like you cannot go back, but
2:05:31
this should be selected out of the box. So, I'm going to say make the current date to be selected by default
2:05:44
and the previous dates should be disabled.
2:05:50
So, looks like this has been implemented. I'll go ahead and reload my application and by default the today's
2:05:56
date should be selected as you can tell. Now it is time to implement the actual functionality. Now for this we don't
2:06:03
really need to explain everything from scratch because we have already you know already built this under the plan.md
2:06:10
file. As you can tell all we need to do is just saying go ahead and implement the phase three which is the generation
2:06:18
pipeline. And just before we ask cloud to implement it, there is something that I want to talk about. So here let's say
2:06:24
you type Tokyo, Japan and then you say generate my trip. In the trip screen,
2:06:30
you would like to see an actual image of Tokyo. You don't really want to get an image of New York, right? Or some kind
2:06:37
of like a beach image. You don't really want to get that. Whatever you type here, you would like to get the image of
2:06:44
that city. So to be able to make this work, you need to visit Unsplash and get
2:06:49
those environment variables. So under the EMV.example, I have already provided
2:06:54
them. So you would like to get the access key as well as the secret key. So let's go ahead and implement it. First
2:07:01
off, you need to visit unsplash.com/developers, then create a developer account. It is
2:07:07
super simple. Once you are logged in, you will just say create a new application. I already have one but
2:07:13
let's just do it from scratch. And there are some guidelines. I think AI already know about them. Like I'll just go ahead
2:07:20
and say accept the terms. And let's give it a name. I'll say triply tutorial.
2:07:26
And then I'll say create application. For the description I think I can say something like AI trip planner app.
2:07:39
I'll create the application and we can scroll to the bottom. You will see the access key as well as the secret key.
2:07:46
Now, don't try to use my values because I'm going to be deleting them before publishing this video. But just go ahead
2:07:53
and get your own values. Then paste it under the env file. Not under the
2:07:58
example, but thev file. So, I'll go ahead and paste them in and then I'll just be right back. So, I just got these
2:08:05
values and put it under the file. Now I'll create a new cloud instance and then I'll just say go ahead and
2:08:11
implement the plan a trip feature and for this it can take a look at the phase
2:08:17
three. So here's my prompt. I said now I want you to implement the generate a trip
2:08:23
feature and we already planned it under the plan file. So take a look at the
2:08:29
phase three. If there is anything that I need to do, just let me know like getting an environment variable from a
2:08:36
dashboard or something similar. But else implement everything by yourself.
2:08:42
Now, while cloud is building it, let's go ahead and visit our image kit dashboard and we're going to get couple
2:08:47
of different endpoints. So, here just scroll to the bottom. I think under the settings, sorry, under the developer
2:08:54
options, you will see three different values. So, you will have the URL endpoint. Just go ahead and copy it.
2:09:01
Then you would like to go and visit the env file. So here we have three different environment variables. You're
2:09:07
going to paste the URL endpoint. You should do it under the env file, not under the example. I don't really want
2:09:13
to show you thev file because I have some secrets there. But what you would
2:09:19
like to do is getting the public key as well, pasting it as well as the private key. Now, if you try to see your private
2:09:26
key for the very first time, you might need to set up a password. Once you set
2:09:31
it up in the next time, you will just put this in, right? Once you fill this
2:09:36
in, you're going to get the actual value. So, I'll go ahead and try to copy all these values and paste it into myv
2:09:44
file. All right. So, after some time, Claude has implemented it and it says here are all the files that I have
2:09:50
generated. So first off we have our schema. Basically it has added all these tables and you can double check them by
2:09:58
going into your neon database. So initially I only had the users table but
2:10:03
now I have all these tables as well. They are empty. We're going to create a trip and hopefully we're going to get a
2:10:11
you know a record for every single trip. And then there are some more files as
2:10:17
you can tell. If you're interested, you can pause the video and go into these files from the source code. But in my
2:10:24
case, I'll just see what I need to do to test this out. It says all environment variables are already set. So there is
2:10:31
nothing that I need to do. But I think I need to start the ingest dev server. So
2:10:36
this is the command that we can start. I have my expo application running on this
2:10:42
terminal. And in a new one, I will run the ingest server.
2:10:49
Okay. So, with this, I think I can go ahead and test this out here. I'll go ahead and search for Tokyo and let's say
2:10:56
Japan. Let's say we would like to go for a couple of days.
2:11:02
Budget. Um, I think I'll just go with comfort. Let's say one traveler. Let's
2:11:08
say culture and travel pace could be balanced. I'll say generate my trip.
2:11:15
Couldn't start your trip unauthorized. I don't know what that means. Like, let's just double check if we have any
2:11:23
any console logs. Looks like not. I'm going to reload and just test out once again. And if it doesn't work, then we
2:11:31
can try to fix it. So, I'll press I.
2:11:42
I'll just say get started. And again do the exact same thing.
2:11:56
Okay. So this is the error that I'm getting. What I'll be doing is getting a screenshot. I'll paste it into cloud and
2:12:02
then I'll say when I try to press the generate my trip button, this is the first thing that I
2:12:09
see immediately. What is going on? Are we missing any environment variables or
2:12:14
you know any kind of configuration? Just take a look at my codebase and let me know.
2:12:20
All right, so turns out I was missing the clerk secret key. Like here you can tell error says what is going on. I'll
2:12:28
just go ahead get my clerk secret key and I will add it to myv file. And just
2:12:33
in case if you don't have it, you can go under the clerk express quick start. Just scroll to the bottom, select your
2:12:41
current project which is triply and then reveal this part. Basically copy this
2:12:46
entire thing which is our secret key. Then paste it into yourv file. I'll just
2:12:52
do it and then come back to the video. So I have just added the clerk secret key to myv file. And if I say generate
2:12:59
my trip, I'll get the exact same error. That's because you need to rerun your application from the terminal. So head
2:13:06
over here, kill the expo application and then just restart it. And you can start
2:13:13
it with the clear command. This is what I have done.
2:13:18
Now if we run this hopefully everything should be working out correctly.
2:13:30
Okay. So, our application is live. Let's go ahead and test this out for one last time.
2:13:42
You can leave everything as default, but I think I'm going to select these options and let's say generate my trip.
2:13:49
Now, we should be able to see the loading screen, which look like this at the moment. That's fine. We're going to
2:13:55
be fixing this. Let me just take a screenshot of it while this is building.
2:14:00
Basically, I'm going to take this as a reference. Paste it into cloud. And then I'm going to say make this look a lot
2:14:06
more cleaner. Um, we'll even say just go ahead copy this entire screen. Let me
2:14:13
just find it. We had a loading screen design.
2:14:20
Where is it? So, I think I don't have it here, but
2:14:27
I'll just provide it to you. So in my case it has failed and turns out I'm missing the openai API key. Now to be
2:14:34
able to get one we can visit the platform.openai.com
2:14:40
and then from here you would like to visit the API keys and then create a new secret key. Now, I have to say that if
2:14:47
you want to use OpenAI, then you need to spend like $5 and it's going to be
2:14:52
completely enough for this project and even for some future projects because
2:14:57
it's going to be extremely cheap to implement this feature. But if you don't if you don't want to pay anything at
2:15:03
all, I think you can use Google Gemini model and you can take a look at it how to set that up. Basically, all you need
2:15:11
to do is getting a secret key or like an API key. Now, if you don't know how to
2:15:16
set it up to Gemini, you can just go into cloud and say, instead of having
2:15:21
the OpenAI API key, I would like to get a Gemini API key, right? How do I do it?
2:15:28
Just walk me through step by step. And then it should be able to give you the entire route so you can get the key. I'm
2:15:35
going to not show you that, but I'll just show you how to get an API key for OpenAI. Let's give it a name. I'll just
2:15:42
say triply tutorial and I think I'll just leave everything
2:15:48
as it is and then I I will say create the secret key. Now you will be able to
2:15:53
see this only once. So you should just copy and immediately save it to yourv
2:15:58
file. This is what I'll be doing and I'll just be right back. So I have just added to myv file and I need to stop
2:16:06
this application and then rerun it again. And now that it's been restarted, let's
2:16:12
go ahead and test this out.
2:16:27
All right. So after some time, as you can tell, the trip has been generated. We have the actual Tokyo image. We have
2:16:33
the budget, accommodation, you know, like how much we spend for accommodation for food and attractions. We have the
2:16:40
full itinerary and then where to stay. Now, this is definitely not what I'd
2:16:46
like to have. The UI is not really matching with our referenced images.
2:16:51
Like, I'm just going to get into that in a second. So, basically, this is what I want to have rather than this one. like
2:16:58
we would like to have a map and the itinerary should look a little bit different than this. But that's fine.
2:17:05
We're just getting there. That's the very first version that Cloud just came up with. Now, we need to do some
2:17:11
follow-ups. And before we do so, if you're wondering like what is happening in the background, you can take a look
2:17:17
at your inest dashboard and see what is going on. So, in the first try, it has failed because we were missing the
2:17:24
OpenAI API key. But, you know, the very last one has worked out. And as you can
2:17:30
tell, like you can go right here, take a look at the details. It's going to show you the entire breakdown of, you know,
2:17:37
like what is happening, what you're getting, which data that you are feeding, and like how much how long it
2:17:44
takes. And let's take a look at the database as well. If we try to reload, we have two different trips. Wait, why
2:17:52
do we have two? Did we run twice? Okay, so one of them
2:17:58
has failed. That's why. Um, okay. So, I think we can delete this
2:18:04
one. This is not going to ever happen again because we fixed the, you know, we
2:18:09
fixed the issue. It's not going to fail again. We have the generation usage for this user. Now I think we have this
2:18:17
table because if they try to generate more than 20 in a single day we are
2:18:22
going to give them some rate limiting right because we don't really want someone to have infinite amount of
2:18:28
generation per day we need to add some rate limiting so that you know like we
2:18:34
don't really run out of budget on openai platform and then we have a table for
2:18:40
chat messages this is going to be stored in the assistant tab in the incoming section ions. But for now, let's go back
2:18:47
into VS Code and then I'll just follow up with the UI improvements. Basically,
2:18:53
I will let me find the screen. Yeah, it is this one. I will reference this and
2:18:59
then I'm going to say again, put yourself in the loop and, you know, take
2:19:04
a screenshot from the simulator, compare it to this one until it looks exactly the same or almost the same. So, here's
2:19:12
my prompt. I just explained the exact same thing. I'll go ahead and run this. Hopefully, our UI should be fixed. And
2:19:18
once this is done, I'll just be right back. So, as you can tell, Cloud is building it. And it is actually
2:19:25
unbelievable how good this is. Like, it's almost identical to what we have provided. Now, can you imagine how long
2:19:32
it would take you to take this design and, you know, build it by yourself? You know, like give this curve, implement
2:19:39
the map. Like, it's unbelievable. this would take at least 2 3 hours for you to
2:19:45
type the code by hand. But here we can just get it in, you know, literally less
2:19:50
than 5 minutes. So that's why I think you should learn how to use AI while still knowing the fundamentals.
2:19:58
Okay. So with that said, I'll just wait for this to be completed. And once it is done, I'll just be right back. And by
2:20:04
the way, I think we got the floating button. Uh when we press, nothing happens. We will implement it later but
2:20:12
it is using the logo that I have provided which is this one.
2:20:19
So after some time cloud has done a couple of different revisions as well. Now the text is visible like previously
2:20:26
it was not really this much visible. I think I'm currently happy with how this
2:20:31
looks and it also gives the attribution to the you know author of the image
2:20:36
which is coming from Unsplash. And if you're using images from Unsplash for free, then you should give the
2:20:42
attribution. This is what they ask from you. So that's why we included right here. We have this button which does
2:20:49
nothing. We can get into that. We can go back. I'm not going to press that because I don't want to go back. Um, we
2:20:56
have the map. It is actually working. We have the itinerary. Now here we just
2:21:01
said it should be 5 days but I can see that we only have one day within the
2:21:07
itinerary. So I'm going to take this as a screenshot and I'm going to ask cloud to fix it. Now the reason this is
2:21:14
happening is because I believe the OpenAI currently sending us only one day
2:21:20
plan but we will just say you know make sure that the output is ready for 5
2:21:27
days. So, we're going to have the first one, second, you know, you get the point depending on
2:21:34
um depending on the duration. So, I'm going to paste this image and then I'll explain this to Claude.
2:21:42
So, currently I like everything that we have in the trip detail screen. But the only problem here is that we have the
2:21:51
duration as 5 days. But within the itinerary, I can only see day one. So
2:21:58
make sure that from OpenAI or from our AI agent the AI model that we are using
2:22:05
we should be able to get the same duration as user input.
2:22:11
So keep this in mind and go ahead implement it. All right. So I just took a quick break
2:22:17
and come back and here we go. Now everything has been implemented as expected. So in our case we wanted to
2:22:24
get 5 days duration and now we have the itinerary day by day in total 5 days.
2:22:30
Okay. So that means this feature is also working as expected. And now maybe it is time to get started with the AI button
2:22:39
or like how do we call it the AI assistant. like we will ask some
2:22:44
questions things like um like go ahead and make the budget a little bit less
2:22:50
right like budget friendly or add more food to the itinerary things like that
2:22:56
and actually you know what we can leave this feature to you know in a couple of minutes but first let's try to add this
2:23:03
feature where we can press this button and kind of like get a drop down so that we can delete this plan right delete
2:23:11
delete this trip and this is going to be super easy to implement. So here I'll just say cloud to implement it. Okay, so
2:23:19
everything works fine. Under the trip details screen at the top right corner
2:23:24
we have a button with three dots. When we press that nothing happens but I want
2:23:30
you to show some kind of a drop-down where you know user can delete the trip
2:23:35
and before deleting it immediately ask a confirmation message. you can use a
2:23:41
native component for it. Um, and if we say delete, like after the confirmation,
2:23:47
it should delete the trip from the database. Um, so yeah, go ahead and implement it.
2:23:54
All right, so this has been implemented and it's a very basic functionality, but there is one thing that I don't really
2:24:00
like. Basically, this should be a delete button instead of three dots. So, I'll go ahead and say
2:24:07
replace the three dots icon with a trash icon.
2:24:12
So, that was a pretty quick fix. Basically, we have updated the name from ellipses to trash. And here is the end
2:24:19
result. Now, I want to add a different button right here, like a camera icon.
2:24:25
When we press that, it should allow us to add a custom background. So here you
2:24:30
should be able to add your own images rather than grabbing one from Unsplash.
2:24:36
So here I'll say right next to the delete button I want you to add a camera
2:24:41
button and when user press that we would like to open up the gallery so that user
2:24:46
can select an image like a custom image from their gallery and update the trip
2:24:53
background image or the cover image. Go ahead and implement this. And for image
2:24:59
optimizations, make sure that you are using image kit. So we don't really want to have large files right here. It
2:25:07
should be optimized using image kit. Okay. So this is my prompt and at the
2:25:13
end I'll just say use context 7. Basically, this will make sure that it
2:25:19
is getting the latest documentation for image kit and it is implementing it
2:25:24
correctly. And while this is building it, we can go into our image kit dashboard under the
2:25:30
media library. You can see your files. Now, in your case, probably you're not going to see these because I have
2:25:37
uploaded them manually, but probably you're going to see a folder like triply. This is what Cloud has generated
2:25:44
for me. And if you go into it, let's just open this up. We have the covers folder. And within this, we have, you
2:25:51
know, this image, which is the one that we have right here. So these images are
2:25:57
saved in image kit to be optimized, right? So let's say this image originally is like 5 megabytes. You
2:26:04
don't really want to store it in that way. So image kit will take this image and compress it or you know like
2:26:11
optimize it as much as possible. So your application feels incredibly fast. Okay.
2:26:17
So that's the media library that you can take a look at. And this is one of the images that I have uploaded in the past.
2:26:23
But this is the one that we created in this um in this project. Okay. So I'll
2:26:29
go ahead and give the access or the permission to cloud to implement it. And
2:26:35
now again while this is building it, there is one thing that I want to mention. So to be able to get the images
2:26:41
like you're going to select them from the gallery and for this there is a package called expo image picker. Okay.
2:26:48
So probably like as you can tell cloud will try to u install it and since this
2:26:54
is a native module we need to rebuild our application. So we'll open up the terminal rebuild it and then to be able
2:27:02
to access to the media library you need to update the app.json JSON file. Let's
2:27:09
go ahead and take a look at it. So here within the app.json, let me maximize the screen. So somewhere here we will add
2:27:16
the like notification. So we will say something like this application which is
2:27:22
triply. Triply wants to access your gallery. So I'm pretty sure you have seen this in real world when you're
2:27:29
using a different mobile application like it is something that you must have.
2:27:35
Okay. So this is one of the tips and tricks that you can keep in mind. But AI
2:27:40
models are really really good. So probably it's going to implement it without us asking it just in case if it
2:27:48
doesn't we can go ahead and you know ask for it. So this is one of the things
2:27:53
that you can take it as a note other than like a vibe coding. You need to know that this is the package that you
2:28:00
need to install and you need to add the permissions or the notifications right
2:28:06
here under the app.json file. So here cloud is still building it and
2:28:11
let me try to walk you through it while this is building it. So as you can tell it is using the expo image picker. Now
2:28:18
this is failing because we need to rebuild the app in a second. Then we are using image kit to optimize the image
2:28:25
and let's just see. I think it has also updated the app.json file. Let me try to
2:28:31
scroll to the top. Okay, so here you can tell. Let me actually show you the entire file. It has added this part. And
2:28:38
here is the permission prompt that our users will get. So it basically says
2:28:43
allow triply to access your photos. So you can set a custom cover image for
2:28:49
your trip. And let me give the permission to claude. All right. So, this has been
2:28:56
implemented. We can see the button right here. I think I want to make it a little bit larger. So, I'm going to go ahead
2:29:01
and find this file. It should be somewhere here. And let me just maximize
2:29:08
the screen. I'll search for trash. Right next to it, we have the camera fill.
2:29:13
I'll just make the size to be something like 20. Yeah, I think this looks way
2:29:18
cleaner. Maybe like 22. Um, so yeah, with that said, we need to
2:29:24
rebuild our application. This is what Cloud says as well because we are using a new native module. So I'll go ahead
2:29:31
open up my terminal, kill this, and then we'll just say something like mpx expo
2:29:37
run iOS. Once this is done, I'll just be right back. So I have just rebuilt the
2:29:44
application, but I cannot access to that previous trip. So, let's go ahead and get started with a new one. Now, we
2:29:51
cannot really get access to it because the trips page has not been built yet.
2:29:56
So, we'll just start a new one. Let's just say I want to visit stumble and
2:30:02
let's say Turkey. I'll put couple of days and I'll just leave everything as it is.
2:30:08
Now, we have one to-do which is updating the loading page. We'll get into it. And
2:30:14
if you take a look at the inest server under the runs, as you can tell, this is running at the moment. So it is working
2:30:20
in real time. As soon as this is completed, it'll be updated in the dashboard as well. So as you can tell,
2:30:27
it has been generated with the actual stumble image, right? This is not just a random place. This is the actual place.
2:30:34
So this is how we set it up with Unsplash. And then you can take a look at the itinerary. This is like five days
2:30:42
um just like previously and we can go into in server you can just take a look
2:30:47
at it. This is completed and then if we reload now we should have two trips
2:30:53
let's try to delete the stumble one right and maybe before that let's try to
2:30:58
update the custom background image. So I'll just press that. As you can tell I
2:31:04
just get access to the library without a question. So my application didn't really ask this for me and I believe the
2:31:12
reason for this is because in the past I've already test this out. So in your
2:31:17
case you will get this permission as the first question and then once you say allow access to the media library then
2:31:25
you will see this screen. So here I'll just go ahead and select something random like this one. Let's say choose
2:31:31
and hopefully it should work out. Okay. So, here we go. We'll go into
2:31:38
image kit dashboard just to double check under the covers.
2:31:44
And here we go. I think that was the previous
2:31:49
like previous background. And this is the test upload. I don't know why we cannot see the
2:31:55
image. Let me just try to reload the reload the page. Okay. So, probably this
2:32:00
is something that has failed. But here we go. We have the actual image. So this has been not only updated in the UI but
2:32:07
also in the image kit dashboard. Okay. Now let's go ahead and delete this trip.
2:32:12
I'll say delete the trip. Um here we got a confirmation. I'll just say yes,
2:32:18
delete. We are redirected to the home screen. Now let's go and visit the database. And
2:32:25
if we reload now, notice how these one has been deleted. So overall everything
2:32:30
is working as expected. Now with that said, the other feature that I want to implement is the updating the loading
2:32:38
screen. So this is an image that I just provided. You can get it from the source code. It is called trip loading screen
2:32:44
design. And we will basically ask claude to make our loading screen to look
2:32:50
exactly like this. And you already know the drill. We'll just say put yourself into a loop. And for this background
2:32:57
image, I think I have the demo, which is this one, right? So you already notice we have already done this couple of
2:33:04
times but I'll just show you my prompt as well. So here's my prompt. I'll go ahead and attach both of these images.
2:33:11
The first one is trip-loading screen design and then the other one is
2:33:18
going to be trip loading screen demo. Okay. So I'll go ahead and run this.
2:33:24
I'll just be right back once this has been implemented. All right. So, as you can tell, Cloud is trying to build it,
2:33:30
and it kind of shows me the end result while it is building it. And as you can tell, it is almost identical to what we
2:33:37
have right here. Like, I can't imagine how long it would take you to build it
2:33:42
by hand. But if you use AI, it can literally build it less than 3 minutes.
2:33:48
I think this has been implemented, and it is trying to create a trip in Tokyo.
2:33:53
Or maybe this could be a mockup UI. But let's just see what it says. One note, I
2:34:00
left the preview that hook in place. Okay, so it basically says I just put it
2:34:07
on the UI so that you can double check. Um, I'll just say yes, strip it out.
2:34:15
Like this has been implemented correctly. If you wanted to, you can go ahead and ask for more follow-ups, but
2:34:22
I'm pretty happy with the end result as it is identical to what I want to have.
2:34:28
All right, so with that said, let's go ahead and commit all of our changes and leave this lesson right here. I will
2:34:35
close everything. Let's go ahead and press command shiftp.
2:34:42
I'll say toggle the status bar visibility. And then as usual I'll create a new branch. So for now let's
2:34:49
say something like so I think I'll just call it as create trip. You can give it a different name and then I will add
2:34:57
everything to this staging area. Let's get a commit message and then we will commit this then create the pull
2:35:03
request. So here while this is trying to get a message I'll go ahead and visit the repo. Let's commit this and then
2:35:11
publish the branch.
2:35:18
So I think I have a pretty slow internet connection but okay it's done. Let's refresh. Here we
2:35:26
go. I'll say create the pull request and then as usual we'll wait for code rabbit
2:35:31
to generate some suggestions. All right. So after some time we got the entire
2:35:36
summary for this pull request. And as usual we are interested in these suggestions. So the very first one is a
2:35:44
minor issue that we have. So I'm just going to skip this because I don't really want to make this tutorial, you
2:35:49
know, too long than it should be. But here we have a major problem. You can read it. I have already done this and
2:35:56
I'll just try to get the prompt for AI agents. So this is one of the steps in
2:36:02
our workflow as you remember. So I'm going to copy it and go into cloud. Let
2:36:07
me just get a new cloud instance and I'm going to paste this in.
2:36:12
Okay, so I'm just going to run this and let's take a look at the other issues that we have. Again, a minor issue which
2:36:19
is related to data integrity and integration. I would say go ahead and
2:36:25
implement them even if they are minor. If you're building a real project, but this is a tutorial so I don't really
2:36:31
want to waste too much time. Instead, I'll only focus on the major problems.
2:36:37
Okay. So, here I'll copy this as well. Now, what you can do is basically copy
2:36:42
every single one of these prompts and paste them under a single instance, but
2:36:48
it's not going to be that great. I think it is always better to just give one, you know, like one task at a time. So,
2:36:56
this has been fixed. I'll go ahead paste the second solution. And you don't really need to wait for this to be
2:37:02
completed. So you can open up a new instance and then go into the next issue, right? Copy it and then paste it
2:37:11
right here. So like at the same time, it's going to
2:37:16
fix this issue as well as this one. And you can just create as much as you wanted to.
2:37:24
Let me just find another major issue if we have this is related to security and
2:37:30
privacy. So I'm going to go ahead copy it and then paste it right here.
2:37:40
So we have another major issue like here you can tell this is the beauty of using a code review tool because cloud by
2:37:48
default is not able to see all these kinds of edge cases right so here you
2:37:54
have a different senior engineer in your team that goes through your codebase
2:38:00
with a certain mindset it literally tries to find some issues like some
2:38:06
security problems um yeah with that said I'll go ahead and just take a look at one of these chats.
2:38:13
They're completed. So, I'll just paste it right here. Now, one of the extra steps would be to actually check out
2:38:20
like check out the code how cloud has implemented it. But since this is a tutorial, I don't really want to waste
2:38:26
too much time as I said previously. Um, so yeah, I'll just go ahead try to
2:38:32
copy the prompts and paste it to cloud to fix them. Here it says you have functional correctness.
2:38:39
So this isn't cross validated against the category amounts.
2:38:46
Yeah. So I think whatever I'll just copy it and paste it right here as a separate
2:38:52
prompt. And Quadrait has an extension. This is what I'm using. Like in the terminal you
2:38:57
can get the comments. You can take a look at it. It's going to be free to install it. Just go ahead and type code
2:39:04
rabbit. Like it's pretty popular as you can tell.
2:39:11
Now once everything is implemented we will go ahead and add a new commit. I
2:39:16
think we have covered every single major issue.
2:39:24
Okay. So this has also been fixed. I'm going to close the chats within the same branch. You don't really
2:39:30
want to switch to master. Okay. Just don't play with it. Make sure you're under the same branch and send the
2:39:38
commit message or the commit. Then we'll sync this up.
2:39:46
So previously we had only one commit here. You can tell but now it should be
2:39:51
two once we sync this up. Now we'll just scroll to the bottom and say merge this
2:39:57
pull request. Now technically code rabbit is trying to run another code
2:40:02
review on this commit but I think we don't really need to wait for it because we have already fixed it with code
2:40:09
rabbit. Okay. So I'll just say merge this pull request confirm it. Once this
2:40:14
is done successfully we'll go back into our codebase. We'll switch to the master
2:40:21
and we'll get the latest changes. Okay. So with that said, I think we are
2:40:27
completely done with this lesson. I'll see you in the next one. All right. So this is where we left in this lesson. We
5- Sentry Integration & Assistant & Trips Screen
2:40:34
would like to get started with the assistant screen. And just before we implement it, I want to talk about the
2:40:40
reason like why you would like to integrate a tool like sentry to your own
2:40:45
mobile application. In my case, I have already implemented it in my own app which is deployed on app store. And now
2:40:52
let's talk about the primary reason behind it. I have some diagrams that I'd like to walk you through and you can
2:40:59
find these diagrams in the description as usual. It's going to be completely free. Okay. So you might be asking why I
2:41:05
need Sentry in the first place. Like what's the problem? What's the solution? And what's the real power of it? Okay.
2:41:13
So here I have a question. When your users face some errors in your application, do you think they would
2:41:19
send you an email explaining the problem or do you think they would delete the application and leave a one-star review?
2:41:27
Well, 100% of the time, or almost, let's just say 99% of the time, they'll just
2:41:33
delete the application and they will leave one-star review. They'll say, you know, the assistant screen doesn't
2:41:39
really work. Go ahead and delete this app. Or, you know, so you got the point. they'll just delete your application and
2:41:46
you have no idea what's the problem. Like some people just leave one-star review without telling you the issue.
2:41:52
They just say app doesn't work. But which feature doesn't really work, right? So you would like to set up
2:41:57
Sentry in your application so that whenever one of your users gets an error, you immediately get notified. So
2:42:05
that could be via Slack, you know, Discord, but by default it's going to be
2:42:10
by email. So I'm going to show you how to set up every single one of them. But here I have more examples that I want to
2:42:17
talk and just walk you through. Okay. So basically Sentry will watch your
2:42:22
application. Okay. So it is your apps watch tower if that makes sense. So here
2:42:27
is the role of the sentry. It is much more than this but I would say these are the fundamentals. So it's going to try
2:42:34
to catch the errors and automatically report the crashes. There is something called sentry logs which are basically
2:42:42
like to put it simply they are console log but structured so they are searchable and they are persisted in the
2:42:49
cloud it is not like just only in the terminal there is session replace which
2:42:54
means that it is just going to show you what your user saw let's say I am one of
2:42:59
your users okay I'm using this app and when I press this button something has failed sentry will take a video
2:43:06
recording of this and show show you that in your Sentry dashboard like it's absolutely unbelievable. And then there
2:43:14
is also features for like performance which comes with traces and bottlenecks.
2:43:20
And we're going to try to implement traces in this tutorial as well. And as I said before, you will immediately get
2:43:26
alerts which will be in real time. You can set it up with Slack if you're
2:43:31
using, you know, if you're building this app with your team. But in my case, I was just building it by myself. I just
2:43:38
left the default option which is a Gmail and then moving forward we have sentry
2:43:44
logs. Now you can basically pause the video and read it. I'm pretty sure it'll make sense 100% but let me just quickly
2:43:51
walk you through it. So instead of using console log, you would like to use sentry logs if you're building a real
2:43:57
application. And here are some of the reasons like console log will leave on the user's device only. When they close
2:44:04
the app, everything is gone. However, on the other side, you have sentry logs which is going to be sent to Sentry's
2:44:12
server, right? So, it's going to be persisted and searchable. But this is
2:44:17
like as I said, it's going to disappear when the app closes. This is plain text
2:44:22
um compared to sentry logs which are like structured and you have like literally tags within them and you're
2:44:29
going to see how to implement them or at least how they look in the dashboard. Then when it comes to the you know
2:44:36
traces, errors and replays of course console log doesn't really have it. It has no connection to the error then a
2:44:44
simple text but sentry logs has everything. So basically you stop guessing but instead start knowing
2:44:51
everything. And here's an example scenario. This is what I explain in every single one of my tutorials because
2:44:58
it's a really really good example. Basically, just think of this scenario where you have 50k users in your app.
2:45:05
This is an e-commerce app and you're getting 500 checkouts daily and some of
2:45:10
them will fail, right? Either it's the credit cards, I don't know, it's the bank or your payw wall solution, right?
2:45:17
Um, if you use console log, of course, you're not going to get the solution. But with Sentry, you can just query the
2:45:24
logs. You can just say show me all the logs related to payment that is an
2:45:30
error. You know here is the city and last 24 hours. Okay. So I hope that this
2:45:36
gives you an idea about the role of the sentry and actually all of the
2:45:41
production grade companies are using them. So you can just double check by visiting sentry.io.
2:45:48
on their landing page. As you can tell, the best companies in the world, including GitHub, Convex, Superbase,
2:45:55
every one of them are using Sentry. And I just put them right here. If you're interested, you can take a look at it.
2:46:01
Like Cursor is using it. GitHub, Versel, Superbase, and even Convex. Now, before
2:46:08
implementing it, if you're interested in the actual documentation, go ahead and check it out. We have Sentry logs and
2:46:15
Sentry Tracing. First, I want to set up both of these and then we can get into the session replays and there is even
2:46:22
something called AI agent monitoring. And this is a new feature and I think it
2:46:27
makes sense to use it in this application. Um, I'll get into that, you
2:46:32
know, in a little bit in the video. But first, let's go ahead and copy this page, paste it into cloud. So, I'll just
2:46:39
open up a cloud instance. Shrink the left hand side. First I'm going to you
2:46:44
know input my prompt. So in this project I want to set up Sentry which is
2:46:50
something that we have already done in the root of this project.
2:46:58
Um like I just paused it because I want to show you that I think it should be under the layout file like we already
2:47:05
have the sand res setup but this doesn't really include the logs or traces
2:47:11
you know this literally only initialize it. So let me complete this prompt. I think I stopped
2:47:17
it without completing it. I said which is something that we already done in the
2:47:24
layout file. So I'm going to reference it and then I'll say now I want you to implement the
2:47:31
sentry logs from scratch. Make sure to keep it simple but add it into into the
2:47:38
functions that would make sense to have sentry logs. Basically I want this feature to help me out in production.
2:47:47
And right below I will attach the official documentation from Sentry so
2:47:52
you can follow along with it. Okay. So, with this in mind, I'm going
2:47:59
to paste the documentation and we'll just run this. Now, while this is building it, you can go ahead and open
2:48:05
up a new chat and do the exact same thing for the traces. Let's just go back to the documentation. We'll copy it.
2:48:14
Now, I think we can paste it right here, but I'll just wait for this to be completed and then I'll follow up. So
2:48:20
after a couple of minutes, Claude has implemented it and it says there are three different really important cases
2:48:26
that you need to have and it says I have already added them. So you can take a look at it but I'll just try to kind of
2:48:33
like quickly summarize. So it's going to send us a warning or an error whenever
2:48:39
an API request fails. Then for the authentication again we are going to either get an info or error depending on
2:48:47
the situation like if it fails of course you want to get an error log and let me
2:48:52
just show you the code part how that look you're basically calling the sentry logger and it has couple of different
2:48:59
methods I believe it should be like six. So we have
2:49:04
um yeah we have debug error fatal info trace and warning and there is a
2:49:10
different usage called fmt like formatting it or formatted I believe but
2:49:16
yeah in general we have six different methods we are calling the error under the catch
2:49:22
info under if you know just to let you know everything is done successfully and
2:49:29
I believe we also have warning Yeah, just like this. So you can take a
2:49:35
look at the source code within these files. Here it says I have already implemented it on the client side. But
2:49:41
if you wanted to, it can also implement it on the server side. I want to keep it
2:49:46
simple. So I'll just say don't do it. But if you just say yes and press enter, it's going to implement that. So on top
2:49:54
of this, I'm going to say okay. So that's perfect. Now I want you to implement the sentry tracing just like
2:50:01
what you have done right here. So make sure it has been implemented in the correct places
2:50:08
like think of it as a real world production ready application.
2:50:15
And here I'll just say I paste the dogs from Sentry below.
2:50:22
Let me just say below. And then I'm going to paste the documentation of sentry traces. right here. And once this
2:50:29
is done, I'll just be right back. Now, while Cloud is building it, you can take a look at the tracing documentation just
2:50:35
to understand what exactly this does. Well, it will basically track your
2:50:41
software performance things like throughput and latency and like you can
2:50:46
take a look at the implementation. I think at this point it is not really important to understand the coding part
2:50:53
of Sentry or any kind of tool really. And that's why they have this button as of 2026 like you just need to understand
2:51:01
what it does and if anything fails only then you can jump into code and you know
2:51:08
fix the issue. It's still I think very very important to understand the basics and fundamentals but not really any
2:51:15
syntax of any kind of third party tool. That's why we have this button in the first place. Okay. So with that said
2:51:22
let's go and take a look at cloud. I think this has been implemented and here it says these are the things that I have
2:51:29
added which is under the generate trip.tsx.
2:51:35
So here is how that work. You use sentry start span you add couple of different
2:51:40
attributes you know name and bunch of different let me just maximize the
2:51:45
screen. Yeah really just bunch of different options. I'll leave it to I'll leave it to you to explore it in detail.
2:51:52
But with this, I think I'm just going to say make sure to implement the session
2:51:58
replace before I ask it. I think it has already been implemented. And let's double check.
2:52:05
Okay. So under the root layout here integrations. Okay. So we say mobile
2:52:12
replay integration. This is the only line that you need to add. And I think
2:52:17
within this you can add some options like mask all images and by default it
2:52:22
is equal to true but I'll make it to be false so that we can see the images in
2:52:28
the sentry dashboard. So you're going to see what I mean in a couple of minutes and then I'll say mask all texts to be
2:52:35
false and I'll say mask all vectors to be false as well.
2:52:41
Okay. So with that I think we are completely done with the sentry setup. Now what I would do in my actual
2:52:47
application as I add more and more features like time to time I would just
2:52:53
come into a cloud instance and I would say you know I have just implemented this new feature I want you to just take
2:53:01
a look at it if we can implement sentry logs tracing or any other feature
2:53:06
really. Um but yeah with with this application I think we have the most
2:53:12
important cases being covered by cloud and sentry has been seted up successfully. Now with this in mind
2:53:19
let's go ahead and get started with the assistant screen. So at this point you know exactly what we're going to be
2:53:25
doing. We'll just take the design and ask cloud to put itself into into a loop
2:53:31
and then came up with this design. Right. So I'll just go ahead and tell this exactly to cloud.
2:53:38
And first let me attach that file. It is called assistant screen UI design. So
2:53:45
basically I want you to build this exact same UI design for the assistant screen.
2:53:51
And I want you to put yourself into a loop where you take a screenshot from the simulator and compare it to the
2:53:59
design until they're identical. Now one thing that we could do instead
2:54:05
of you know explaining this every single time I think we can put this into cloud.md right this is just something
2:54:12
that I realized we can put it into cloud.md like let me show you I think we're using
2:54:19
agents.md instead of cloud.md but you get the point here we can add something
2:54:24
like under the conventions like you would explain it right here and
2:54:30
then in your chat you would say, you know, go ahead and follow it within the cloud. MD file or agents.m MD. But in
2:54:38
this case, I'll just explain it and run this. So, cloud has implemented it
2:54:43
almost in one shot. Basically, in the first try, there was like a small issue
2:54:49
which is this extra space. So, I just follow up. I said there is some extra unnecessary spacing. Go ahead and delete
2:54:56
it. And also it first included these chats which are coming from the design
2:55:02
image. Let me show you that like it tried to copy the text. But again uh by
2:55:08
itself it has fixed it. So let's go ahead and test this out. I think first I'm just going to reload my application
2:55:15
cuz it's been a while since I haven't used this. Okay. So here I'll go ahead and say
2:55:21
something like hey how are you doing?
2:55:30
Okay. So, one of the things that I want to fix instead of having a loading spinner, I want to I want to have this
2:55:38
as streamed just like in chat GPT, right? So, I'm going to say where should
2:55:44
I visit in April
2:55:49
like instead of having the loading state, we would like this to be streamed. And this is pretty easy to
2:55:55
implement actually. So I'll just go ahead and ask Claude to do it. Like there is not too much logic behind it.
2:56:03
Okay. So the assistant screen works as expected. The only add-on feature. So I
2:56:09
have accidentally paused the video and I'm recording this part from the feature. Basically this was my entire
2:56:14
prompt. So I said the assistant screen works as expected. The only add-on feature that I want to have is streaming
2:56:21
for chat replies. Basically, instead of having a loading spinner, I want to have the messages just to get get them like
2:56:29
chunk by chunk. It should be streamed and then I said go ahead and implement it. So that was my prompt. Now let's
2:56:36
follow along with the video. So looks like it has been implemented. Let's go ahead and test this out. Basically it is
2:56:42
using a readable stream and the stream option is equal to true. So here I'll go
2:56:48
ahead and say where should I visit
2:56:53
in April let's say
2:56:59
okay so as you can tell we are getting you know getting the answer chunk by chunk which means the streaming has been
2:57:06
implemented correctly there is one optimization that we can do like we sent the message but we still see it in the
2:57:14
input so we'll just say basically go ahead and reset the input as soon as
2:57:20
we sent the message. So here it says it is done. I'd like to
2:57:26
test this out. I'll just say, "Hey, how are you doing?"
2:57:32
Okay, as we can tell input has been reseted. Now before we go into the next
2:57:37
screen which is trips I think here there is something that we need to set up which is going to be sentry AI agent
2:57:45
monitoring. Now with this feature we can monitor and debug our AI systems with
2:57:51
full stack context. So we will be able to track key insights like token usage,
2:57:58
latency, tool usage and even the error rates and the data coming from here will
2:58:04
be fully connected to your other sentry data like logs, errors and traces. Now
2:58:10
this could be very important and actually useful just to see how your users are using your application. So
2:58:17
basically, Sentry will get every single input from your users and even the outputs from your AI agent and you can
2:58:25
just time to time check it out from your Sentry dashboard and you will be able to understand how your users are using this
2:58:32
assistant screen. Do they ask general questions or more questions that are
2:58:38
related to trips and you know travel? So this is something that we would like to
2:58:44
implement definitely. Here I'll go ahead and copy this entire page. If you're interested, you can take a look at the
2:58:50
code as well. Like just see how they are implementing it. But really this syntax
2:58:55
is not really important. That's what I would say. Okay. So I'll go ahead and within the same cloud chat instance I'll
2:59:03
just say in this project I would like to implement Sentry AI agent monitoring.
2:59:09
And then I said I want it to be implemented specifically in the assistant screen which is this one. And
2:59:15
I said I pasted the documentation from Sentry down below. Go ahead and follow along and build it. So I'll just paste
2:59:22
the documentation and let's run it. All right. So this has also been implemented and off camera I asked this question
2:59:30
which is when to visit Istanbul? What is the best time? Now, if you go into your Sentry dashboard under the explore and
2:59:37
LLM calls, just select your project and you're going to see all the calls that you have just made. So, here if you're
2:59:44
interested, you can press that and get into the details. But here you can see a quick breakdown like how much does it
2:59:51
cost how many to how many tokens you have used you know the model your input
2:59:57
and let's just press the actual ID and get into the details like there is even
3:00:02
the AI view which I'll get into it but here you have the input this is the
3:00:07
input from assistant basically it is the very first message then we have the user
3:00:12
as well as the output so that's the exact same output that we have right here. So, this would be a really good
3:00:20
dashboard to just go ahead and analyze your application and your users how they
3:00:26
are using your application. And as I said, there's even the AI view. You can press that and get into the details if
3:00:33
you're really interested. So, I will leave the dashboard for you to explore.
3:00:38
And here you can tell like we have I think like this call is slow. And then you can just jump into your codebase
3:00:45
talk with Claude. why this is, you know, why this is slow and how can we make it faster. That's the role of Sentry here
3:00:52
to help you out to help you out to see which part of your apps are slow and you
3:00:58
know how everything comes together in terms of performance and error tracking.
3:01:04
Okay, so with that said, I think I'm pretty happy with the assistant screen, but I think we have a problem. So if I
3:01:10
try to reload, we don't really save any questions in the database.
3:01:16
or any chats, right? I'll just double check by going into my database.
3:01:22
Yeah, like we literally don't have any chat messages. This should be pretty easy to implement. Basically, we will
3:01:28
have one endpoint. It is just going to call our database and insert into the
3:01:33
table. So, I'll just talk with cloud. Under the assistant screen, everything
3:01:40
works as expected. The only thing that we are missing is storing the messages in the database. Go ahead and implement
3:01:47
it in a way that the messages are saved in the database. And if we press the
3:01:54
delete button at the top of the navbar, it should delete the messages from
3:02:00
database for the current user. Before you delete the messages, make sure to ask for a confirmation message.
3:02:09
Okay. So, I'll just send it and let's see how it'll end up. All right. So, this has been
3:02:15
implemented. First, I thought it is not really working correctly because I was checking the database and the chat
3:02:22
messages table was empty. But turns out clot has created the assistant messages
3:02:30
as a separate table and we have all of our questions and answers from AI. Now,
3:02:36
let's go ahead and delete it. And just before I do so, let me explain the difference. Basically, this is for the
3:02:42
table, you know, for the assistant screen. But chat messages is for the
3:02:48
refining the UI. So, this is something that we'll get into in the incoming sections. For now, let's go ahead and
3:02:55
just say, you know, clear the conversation. Everything is gone. Let's go back into database. Reload. And as
3:03:01
you can tell, it has been cleared out. So, everything working as expected. Okay. So I think with this we are
3:03:08
completely done with the assistant screen and maybe it is time to get started with the trips screen. Now I
3:03:15
think I'm just going to complete it in this lesson and then we're going to commit our changes because here there is
3:03:22
nothing really complicated other than fetching our trips and displaying it. So
3:03:27
for this I already have the design. Let me just show you that. I think it is
3:03:33
yeah it is this one. We basically want to sorry we want to fetch every single trip
3:03:41
that we have for the current user and just display them you know just like this. So I'm going to reference this
3:03:48
file which is called trips screen UI design.
3:03:53
So I want you to build the trip screen and make it exactly identical to the
3:04:00
attached image. You can put yourself into a loop of taking a screenshot from the simulator and comparing it to this
3:04:08
design until it is identical. Okay. So, I'll just wait for this to be
3:04:14
completed. Once it is done, I'll just be right back. All right. So, as you can tell, this has been built. It is
3:04:19
implemented as we expected. I think I'm pretty happy with the end result. However, if you wanted to, you can go
3:04:26
ahead and ask for some follow-ups just to make the UI a little bit more clean. But if you press to the cart, it's going
3:04:32
to take you to the trip details screen. Now, I just realized we haven't really implemented this feature yet. This is
3:04:39
something that we can do in the incoming section. For now, I think I'm pretty happy with how everything looks so far.
3:04:47
Okay, so with that, let's go ahead and commit our changes and leave this section right here. In the next section,
3:04:53
we can implement this AI feature and I think the profile screen. Okay. So, with
3:05:01
that said, I'll go ahead and maybe close everything. Let's create a new branch as
3:05:06
usual. For the name, I think, wait, what did we done in this section? We created
3:05:13
the assistant as well as the trip screen. So, I'm just going to say assistant
3:05:19
and let's just say trip screen or let's just say screens.
3:05:27
Yeah, I think I'll just come up with this name. Let's stage everything. Get a commit
3:05:33
message.
3:05:39
Let's publish the branch. We'll go into source code.
3:05:47
compare and create the pull request. Now, as usual, I'll go through the fixes
3:05:53
right here. I'll commit that and you know, we'll move on with the next with
3:05:58
the next lesson. All right. So, after some time, as usual, we got the quick summary by code rabbit. Then, bunch of
3:06:05
different suggestions that are actually important. Now, this is a tutorial. As I said, I don't really want to waste too
3:06:11
much time. So, I'm not going to go ahead and, you know, fix every single one of these. But in the previous lessons, we
3:06:18
have already done this. So, I'll just go ahead and merge this pull request. But
3:06:24
you already know what to do. You will basically get the prompt for AI agent. Copy this, paste it into cloud or
3:06:31
cursor, whatever you're using. And once you have the fixes, you will commit this
3:06:36
right under the same branch. And then you will just come here. Eventually you'll say merge the pull request. So
3:06:42
this is what I'll be doing. I'll just confirm. And once this is done, we can go back
3:06:48
into VS Code, switch to the master branch,
3:06:54
and then I'll just sync this up by getting the latest changes. Okay. So with this hopefully I'll see you in the
3:07:01
next lesson. All right. So now we would like to get started with the profile screen. Just before we do so, there is
6- Profile Screen & Legal Pages
3:07:07
something different that I want to talk about and then we'll get into this screen. So there is something called
3:07:13
experiments specifically. This is coming from ingest and this will basically
3:07:19
allow us to test our code changes against live production traffic. I think
3:07:24
this is one of the use cases that every single one of us would need at some point. So here I'd like to take couple
3:07:31
of minutes and walk you through it. Here I have some diagrams. Let me walk you through it and then we'll get into the
3:07:37
documentation and we'll see how to implement it. Um like there is a really cool use case for our application and
3:07:44
like I'm pretty sure it'll make sense. Okay, so first off there is a situation that every developer hits at some point
3:07:51
and let's try to go through it. So you write some code that already works. Now
3:07:56
you want to try a different version. This could be a new payment provider, a faster database query, or in our case,
3:08:04
it's going to be a different AI model. But here is the scary part. So you might
3:08:09
think if I swap it, if I swap it for everyone, and if it is worse, like if it
3:08:14
is slower, more expensive, breaks more and so on, then all my users will feel
3:08:20
the pain at once, right? So we don't really want to test it for every single
3:08:26
one of our user at once but instead we would like to go with a different path which is a bit more careful or I would
3:08:33
say safe to implement. So here inest comes with the experiment feature and
3:08:39
let's try to go over it. So basically it is group.experiment experiment and this
3:08:44
will let you to run two versions of the same code at the same time and
3:08:49
automatically decide which one each request uses. So here in our case we
3:08:54
will write something like use the old way 90% of the time and the new way 10%
3:09:01
of the time. So in our case like we will use GPT40 mini in like 90% of the time
3:09:08
but we also want to test this out like this is a little bit more expensive but it is way smarter than mini right the
3:09:16
mini model. So instead of like testing this out on every single user because it could get pretty expensive. What we'll
3:09:23
be doing instead is just using it in like 10% of our user base. And depending
3:09:28
on our metrics, maybe we would like to increment it, right? We could make it something like 50% and this one also
3:09:35
50%. So this is an example code block which is actually coming from the documentation. We'll just get into it in
3:09:42
a second. And here let's talk about the benefits of this feature of ingest. So
3:09:48
basically this is low risk because instead of going as I said like 100% of
3:09:54
your users you just go first at 10%. If it is bad you can just bring it back and
3:10:00
you know not every single one of your users will complain only the 10%. Then
3:10:05
you get real data for free. Now this is a big one because inest is already tracking how long each run takes, how
3:10:13
often it fails and how much it costs. So that's one of the other benefits and the
3:10:19
other one is like you can decide on facts and not guesses right because in
3:10:24
your inest dashboard you will be able to see the um like you will be able to see
3:10:30
the metrics and finally it is pretty easy to dial up or log in like as I said
3:10:36
if if it turns out well you can just go 50/50 right 50% for the in our case
3:10:42
let's say mini model and 50% in the max model and the only thing you need to do
3:10:47
is basically updating these two values and that's it and here at the very end I
3:10:54
just added an image just to visualize it you can take a look at it basically we keep the 90% of our users in the same
3:11:01
route as previously but the 10% tries the new model and then eventually
3:11:08
depending on the analytics you will be able to select one of these routes okay so with this now as usual You don't
3:11:15
really need to read the entire documentation as of 2026. I hate hate to
3:11:20
say this, but that's the reality. So, I'll just go ahead and copy the entire markdown. This has been prepared for us
3:11:27
by the inest team. So, they basically say just copy it and paste it to your LLM. But if you're interested, I would
3:11:34
say just pause the video. I'll link this in the description. You can just take a look at it like how that work. And here
3:11:41
I'll go ahead and paste it into VS Code. Let me just find it.
3:11:47
So I'll just get a cloud instance and I'm going to say so inest has the
3:11:52
experiments feature. I will link the documentation right below. I want you to
3:11:58
go through it and in our case use GPT40 mini model and GPT40
3:12:05
model. So here I just paused the video and fixed these models. I just put the
3:12:11
correct name. Um here I'll just say for the 40 mini model we would like to use
3:12:17
it in 90% of the times and for the you know regular model we would like to use
3:12:23
it in 10% of the time. So read the documentation and then implement it correctly in our application without
3:12:30
breaking any other features. Okay. So, I'll just copy the
3:12:36
documentation. Um, I'll just go back, paste it right here.
3:12:43
Now, this has nothing to do with the profile screen. So, while this is running it, we can just go ahead and
3:12:49
within a new instance, we can build the profile screen. And for this, I have two
3:12:54
different images. You can grab them from the source code. This is the profile screen design first. And the second one
3:13:02
is basically after you scroll. So like this is up until the help and support.
3:13:08
And if you scroll, this is the rest of it. I'm going to attach both of them into this new chat. And I'll and then
3:13:14
I'll just say build it exactly what we have right here. And I think this is asking for permissions. I'll just give
3:13:22
the access. So here I'll go ahead and say profile screen design one. and let's say profile
3:13:29
screen design too. Now this is kind of annoying that you have to give access
3:13:35
every single time if you want to if you want cloud to edit automatically everything without asking there is a
3:13:42
bypass mode which is something that I can show you in a couple of minutes.
3:13:47
Okay. So while this is building it I'll just go right here and I'll say now I want you to build the profile screen for
3:13:54
me. I have attached two different images which is the entire profile screen that
3:13:59
I want you to copy and I want you to put yourself into the loop where you take a
3:14:04
screenshot from the simulator and then compare it to these designs until they
3:14:10
are identical. All right, so this is the profile
3:14:15
screen. I think it is looking pretty similar to what we have provided. I just don't know if the delete account button
3:14:21
is working. So I'm going to go ahead and just ask a follow-up. So just make sure that the delete
3:14:28
account button is working. Basically when user press that first ask a confirmation and if user confirms it, we
3:14:36
should be able to delete the user from both clerk and from the database. I
3:14:41
believe the deletion from database will be handled from web hooks. So just make
3:14:47
sure to delete all user data like the trips, I don't know chat messages. etc.
3:14:52
from the database. Okay, so this will basically go ahead
3:14:58
and implement it or at least it should. And once this is done, we can test this
3:15:04
out. All right, so this has also been implemented. Now, I don't really want to test this out. I don't want to press
3:15:10
this button because it would delete the account. We can test this out just before we end the tutorial. For now, I
3:15:16
want to show you how to implement the privacy policy and terms of service.
3:15:22
Basically, when we press them, it should navigate us to those screens. And these
3:15:28
are something that is not really optional, but you have to have them if you if you want to deploy your app to
3:15:35
the app store. So in my case, I have already, you know, built an example page
3:15:40
for this app, but I'm going to show you the entire process of building it from absolute scratch. Like how do you get
3:15:47
the privacy policy? Let me show you the screens. Like how do you build it correctly? Of
3:15:53
course, you let AI to build it, but I have some prompts that I'm going to share with you, and they are project
3:15:59
agnostic. So you can build any kind of project and use these prompts. I think they're they will just generate really
3:16:06
really good results and then we will deploy it with Cloudflare workers. Um
3:16:13
I'll get into that as well. But notice how we are using the same logo, you know, the same theme which is blue and
3:16:20
we will basically build it within the same codebase. Okay. And I will also show you how to
3:16:27
get these beautiful, you know, mockup images. So, first off, let's actually go
3:16:32
ahead and get some of these mockup images. For this, there is a website called shots.so.
3:16:39
So, you would like to go ahead and visit it. It is like free to get started with, but they have paid plan as well. In our
3:16:47
case, we absolutely don't need the paid plan. So, I think these are the things that I have generated in the past, but
3:16:54
let's just say start over. Okay, this is what you're going to see initially. And
3:17:00
within here, we would like to select a style, you know, some borders, a shadow,
3:17:05
so on and so forth. First off, I think I'll just say let's take a look at the
3:17:10
templates like UI showcase. Maybe we can just say
3:17:16
frame. Let me double check pretty quickly. I
3:17:23
think there should be something like, you know, iPhone 16 or 17 Pro.
3:17:29
All right. So, I just found it. Basically, you will press this button and then you will select one of the
3:17:35
mockups. In this case, I'll go with iPhone 17. For the background, I don't really want to have this colorful
3:17:41
background. So, we can go under the frame and, you know, just get the white background. And actually, we would like
3:17:48
to get a transparent background. So, here you can, I think, just say no
3:17:53
background at all. This is what we'll do eventually. But first, let's just select the white one. And then here you can
3:18:00
select a couple of different variations like position would be updated. And I
3:18:05
think in my case, let me put them side by side. So in my case, I'm using this one, which I believe, yeah, I think it
3:18:13
is this one. You can even get like the three shots one at a time. And then all
3:18:20
you need to do pressing this button and uploading your images. You can grab those images by coming into your
3:18:26
simulator, take a screenshot. So here, I think I'm taking a video recording. I
3:18:32
don't know how that happened. So I'm just going to say delete this. But basically, if you press this button,
3:18:37
it's going to take a screenshot. It's going to save it to your desktop or downloads, whatever. Then you would just
3:18:44
press this button. Okay, select the image and get it right here. So what you would like to do is taking screenshots
3:18:51
of some of these screens like the home screen, I don't know, assistant authentication, so on and so forth. This
3:18:58
is what I have done. And then I just exported these images.
3:19:03
Okay. So once you are ready, you'll just say export and make sure to select the background as transparent.
3:19:10
Like here, just to give you an example, I have selected this layout preset and I have uploaded this image. And then you
3:19:17
would just maybe you can even zoom in. Yeah, I think I would leave it like this. And then I would just export it.
3:19:25
Then once you export it, put it in your Visual Studio Code, right? You would
3:19:30
like to go maybe under the file explorer. And let's create a folder called legal. And this is where we'll
3:19:37
put our legal pages as well as this entire website. So, all you need to do
3:19:43
is grabbing these images that you exported and then putting them right here. This is what I'll be doing. I'll
3:19:50
just grab them from the source code and then I'll just be right back. So, I just got those images and I put them under
3:19:56
the legal folder. So, here you can tell we have the demo one, demo two, and we
3:20:01
have the hero.png. And then I took the entire screenshot of this website and
3:20:07
like I'll just say use this as an inspiration so we can kind of like get a similar result to this one. Now I think
3:20:15
it is time to get started with this legal page or the landing page and we
3:20:21
can spin up a new cloud instance for it. So here I'll go ahead and maximize the
3:20:27
screen and I'll talk with cloud. So we have built our entire mobile application. Now it is time to get
3:20:34
started with a landing page. First off, we want to have a beautiful UI design.
3:20:39
And for this, I will attach a file called UI inspiration.png.
3:20:45
I want you to clone it. And then I want you to build me a privacy and policy
3:20:51
screen. for the content. I will attach some prompts later at some point, but
3:20:57
for now I just want you to build me the entire home screen or the landing screen
3:21:02
for this legal page. And then here I'll just follow up and I'll say we would
3:21:08
like to deploy this legal folder to Cloudflare workers for completely free.
3:21:14
So keep this in mind and come up with the UI design. Don't use any kind of you
3:21:20
know external technologies other than HTML and CSS. Keep it simple yet to
3:21:25
working. So this should be working.
3:21:32
Okay. So with this I think I'll just send it and I'll wait for the entrance. Now while this is building it there is
3:21:38
another kind of like tips and tricks that I want to share with you. So let's say you install these images but they
3:21:44
are like let's say 5 MGB. You definitely don't want to have it in your landing
3:21:50
page as five megabytes, right? In my case, like I have compressed them. And
3:21:55
how do you do it with claude, right? So, basically just go ahead and ask cla in a
3:22:01
separate chat. Let me just maximize it. You would say, you know, attach the image. Let's say demo 1.png and just say
3:22:10
use ffmpeg, which is a tool. Let's say ffmpeg.
3:22:15
I'll just give you the prompt. I'll say use ffmpeg and compress this image. This is what I generally do.
3:22:23
And you know if you don't have ffmpeg installed on your laptop, you can just
3:22:29
ask colad to install it for you. So here you can follow up and you would just say
3:22:34
something like install ffmpeg if I don't have it already. And
3:22:40
sometimes like it it has to use python and you can just give access to it as
3:22:45
well. So this is one of the things that I think every VIP coder should keep in mind even though we are not really doing
3:22:52
wipe coding here. But yeah basically this is one of the things that I want you to keep in mind. It's really really
3:22:59
important. Have your original image use ffmpeg and compress the image. This is
3:23:06
exactly what I have done in my actual application as well which is the one that I mentioned in the past. like this
3:23:13
one here. I've used ffmpeg almost in every single image to compress it and
3:23:19
not really ship something really really large. All right, so Claude is still
3:23:24
building it, but I just went ahead and run this file. If you take a look at it, it is almost identical to what we have
3:23:32
right here. So I'm just going to put them side by side. Like this is the one that we created with Claude right now
3:23:39
and this is the original one. like it's literally a clone of it. There is one thing that I realized here. We are not
3:23:46
using the actual logo. For this, I'll go and visit VS Code under the design. I'll
3:23:51
just copy the logo.png with Ctrl C and then I'll paste it right here. I think
3:23:57
while I was talking, Claude has just went ahead and copied the logo as you
3:24:02
can tell. So, I'm going to delete the copy from here and it's going to be using it now here. I think you can take
3:24:08
a look at it. I believe it says like I just copied the trip logo png.
3:24:17
Okay, so with this, let's go back into the local host. If I reload, hopefully this should be updated in a couple of
3:24:24
seconds. And now while this is building this, we can go and visit the privacy policy,
3:24:31
which doesn't really have anything. Same for terms of service and the support screen.
3:24:38
I'll just go back into cloud. But first, let me copy my prompts. So, this is the
3:24:43
prompt for privacy. Sorry, this is the prompt for terms of service. So, I'm
3:24:48
going to copy it and then I'll just paste it right here.
3:24:54
So, let me kill these images.
3:24:59
Okay, I'll paste this in. And right after this one, I'll get the second
3:25:04
prompt, which is for the privacy policy.
3:25:15
All right. So this has been implemented and then I just follow up with the other prompt for the privacy policy. Now just
3:25:23
because this is implemented that doesn't mean you need to update anything. Well, of course, Claude will not be able to
3:25:29
put your legal entity or the you know contact address so on and so forth or
3:25:35
like the minimum age for this application etc. So what you need to do like you will just get the entire page.
3:25:42
Let's visit it. Maybe you would like to pretty quickly read it or ask cloud to
3:25:48
kind of like what I need to provide in here. As you can tell, there are a couple of different placeholders that
3:25:54
you need to update, but other than this, the entire page will be completely ready. Now, I just did the exact same
3:26:01
thing for the privacy policy. Once it is done, I'll just be right back.
3:26:08
So, here we go. Cloud is done with this as well. We have the terms of service. Now, I also said update the logo. So,
3:26:15
just use the logo.png. And I think I'll just say add the support page as well
3:26:21
because when you try to deploy your app to the app store, they want you to pass a support page here. I'll just say just
3:26:28
build me a basic support screen. So under the legal pages, I want you to
3:26:35
build me a pretty simple support screen and link it in the home screen. So in
3:26:42
the footer, we have the support link. Make sure it takes us to that page.
3:26:51
All right. So here we go. We have the support screen as well. It is working as expected. I think UI is looking pretty
3:26:58
clean and crisp. Now it is time to deploy it. Right. We don't really want to run this on the local host only. I'll
3:27:05
be using Cloudflare workers which is really easy to implement and it's completely free to get started with. So
3:27:11
go ahead and login. In my case, I'll just log in with my GitHub account. Then once you're logged in, you will just go
3:27:17
into cloud and then we'll just say like under this chat I'll just say
3:27:24
go ahead and deploy the legal folder to cloudflare. I have already authenticated
3:27:29
using the wrangler tool. So yeah, just go ahead and deploy it.
3:27:36
Now if you don't know already, Wrangler is the CLI tool for Cloudflare where you
3:27:41
can deploy your apps from your terminal. And in this case, Claude will use the terminal for me with the wrangler tool
3:27:49
and it's going to basically deploy my app. If you are not authenticated, cloud
3:27:54
will ask you to kind of like authenticate. You know, you can ask how can I authenticate with Wrangler and you
3:28:02
know it should be it should be pretty easy to get started with. And I think here we still have some permissions.
3:28:09
I'll just wait for this to be completed.
3:28:15
Um once this is done, I'll just go ahead and run this. Okay, so this is done. It
3:28:21
has built the support screen. Now I'll just go ahead and run this. After a couple of minutes, we should have our
3:28:27
application or the landing page deployed on Cloudflare.
3:28:32
So after a couple of minutes, Claude has deployed our legal pages and it is under
3:28:37
this URL. So I have just copied it and paste it right here. As you can tell, it is live and like it is working in
3:28:45
production. We have the privacy policy, terms of service
3:28:51
as well as the support page. Okay, so that was just an example, but you know,
3:28:56
now we have the prompts. Now we have the workflow to build this kind of a, you
3:29:02
know, this kind of a landing page with these beautiful mockups. I think this is a workflow that you can copy for every
3:29:09
single one of your next projects and especially for mobile applications. Now
3:29:15
with that said, I think we are completely done with this project. However, there is one feature that we
3:29:21
haven't really implemented yet and I think I'll just leave it as a challenge for you. So here I have attached the
3:29:28
image which is the refine AI UI design. So basically within the trip details
3:29:34
screen I'll just show this pretty quickly and I don't know what this is. Let's
3:29:40
just say try again. Okay probably just a demo error that we have in development.
3:29:46
So this is the feature that I want you to implement and it's been like more than 3 hours. By everything that you
3:29:53
have learned so far you should be able to implement it pretty quickly. And I have even attached a demo screen for
3:30:00
you. If you didn't really like this, you can take a screenshot and ask GPT to
3:30:07
generate you a grid of nine. So you can get your own version and then put it
3:30:12
right here. This is also something that I have talked about in the past. And then all you need to do is just going
3:30:18
through this workflow once again, run code rabbit or any kind of AI code
3:30:23
review really. And you know if if the feature is complete save the progress
3:30:29
and that means we have no more feature. So project is completed. Okay. So with
3:30:35
all that said let's go ahead and create a new branch and just commit our changes. For this I
3:30:41
think I'll just call profile. Yeah I'll just say profile and let's
3:30:47
just say legal pages.
3:30:52
And then I'll go right here. Stage everything.
3:30:58
So basically the exact same workflow that we do as usual. Commit to publish
3:31:04
the branch. Let's go back into the source code
3:31:09
and we'll just create the pull request.
3:31:15
Now I would usually wait for this and get the suggestions by code rabbit and implement it if it was my actual
3:31:22
application and this is something that I have even showed you in the past but you know we are almost at the end of this
3:31:28
tutorial so I don't really want to waste any of your time. I'll just go ahead and merge the pull request but I would
3:31:35
highly highly recommend you to take a look at the suggestions if you are building an actual application. So I'll
3:31:41
go ahead and say confirm the merge. Once this is closed, like the PR is closed,
3:31:47
we'll just go into VS code. Let's switch to the master branch and then we'll get
3:31:53
the latest changes. Okay. So I'll provide the source code to you for completely free. You will get it
3:31:59
in the description. And with that, I think we are completely done with this project. Now I think we have learned
3:32:06
bunch of different concepts other than this workflow. like we have learned about web hooks, we have learned about
3:32:13
angrog injest experiments, all about sentry AI agent monitoring, how to build
3:32:19
legal pages and even some you know some of the most important AI concepts like
3:32:25
cloud.md and agents.md. Okay, so with this you can get the
3:32:30
diagrams in the description as well. I hope this course find its goal like we
3:32:37
didn't really get the exact same end result with the demo application but it
3:32:42
is very very similar and I hope that you're able to see the workflow that we used in this course. Now if you actually
3:32:49
want to get your application built in two weeks with us like there is an
3:32:55
entire school community you can join and this is kind of like shameless plug that I do right here. Okay. So, with that,
3:33:02
hopefully I'll see you in the next video.