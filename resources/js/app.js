import { createApp, h } from "vue";
import { createInertiaApp } from "@inertiajs/vue3";
import NProgress from "nprogress";
import "nprogress/nprogress.css";
import { router } from "@inertiajs/vue3";

router.on("start", () => NProgress.start());
router.on("finish", () => NProgress.done());

createInertiaApp({
    resolve: (name) => import(`./Pages/${name}.vue`),

    setup({ el, App, props, plugin }) {
        createApp({ render: () => h(App, props) })
            .use(plugin)
            .mount(el);
    },
});
