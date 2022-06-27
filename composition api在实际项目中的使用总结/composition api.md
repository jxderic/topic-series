# composition api在项目中的使用总结

### 背景

第一次知道composition api是从vue3的RFC提案中听说的，印象最深的是options api和composition api的对比图：

![file](http://image.openwrite.cn/30150_0F4155DF257C48E48F1F42C52B698714)

这种图片很清晰的描述出composition api的优势：能够把相同逻辑关注点都归为一组，不用在不同的选项中来回滚动切换，这样能达到更好的逻辑复用的效果。这点对于我有很大的吸引力，很多复杂业务中，template的内容很少，大部分代码都是js逻辑，功能比较复杂，为了更好的代码复用，采用了mixins封装了很多公用逻辑，但mixins的缺陷很明显，mixins里面使用的变量或方法在vue组件中复用需要反复横跳，但当时受限于vue2，只能达到这种程度，如果现在重新做，使用composition api能达到更好的逻辑复用作用。

### composition api

首先先熟悉一下composition api，有哪些api，目前只需要掌握加粗的部分，就可以体验组合式api的魅力了，其他的api等需要用到了再通过[vue3的官网文档](https://staging-cn.vuejs.org/api/)深入学习。

![file](http://image.openwrite.cn/30150_EC3C8265B4D44D64B59CCE9F71765192)

reactive 用来将对象转变为响应式的，与vue2的observable类似，ref用来获得单独或者为基础数据类型获得响应性。为什会会有两个获得响应性的api呢，稍后我们将具体说明。computed、watch，provide、inject不用怀疑和vue2中做的是一样的事情。你一定注意到下面这些加了on开头的生命周期钩子函数，没错在组合式api中，这就是他们注册的方式。但是为什么不见了beforeCreate和created呢？因为setup就是在这个阶段执行的，而setup就是打开组合式api世界的大门。你可以把setup理解为class的constructor，在vue组件的创建阶段，把我们的相关逻辑执行，并且注册相关的副作用函数。

现在我们说回ref和reactive。

- reactive在官网中的说明，接受一个对象，返回对象的响应式副本。
- ref在官网中的描述"接受一个内部值并返回一个响应式且可变的 ref 对象。ref 对象具有指向内部值的单个 property.value"。

听着很绕口，简单来讲就是reactive可以为对象创建响应式；而ref除了对象，还可以接收基础数据类型，比如string、boolean等。    那为什么会有这种差异呢？在vue3当中响应式是基于proxy实现的，而proxy的target必须是复杂数据类型，也就是存放在堆内存中，通过指针引用的对象。其实也很好理解，因为基础数据类型，每一次赋值都是全新的对象，所以根本无法代理。 那么如果我们想取得简单类型的响应式怎么办呢？这时候就需要用到ref。

```typescript
class RefImpl<T> {
  private _value: T
  public readonly __v_isRef = true
  constructor(private _rawValue: T, public readonly _shallow = false) {
    this._value = _shallow ? _rawValue : convert(_rawValue)
  }
  get value() {
    track(toRaw(this), TrackOpTypes.GET, 'value')
    return this._value
  }
  set value(newVal) {
    if (hasChanged(toRaw(newVal), this._rawValue)) {
      this._rawValue = newVal
      this._value = this._shallow ? newVal : convert(newVal)
      trigger(toRaw(this), TriggerOpTypes.SET, 'value', newVal)
    }
  }
}
...
const convert = <T extends unknown>(val: T): T =>
  isObject(val) ? reactive(val) : val

```

ref通过创建内部状态，将值挂在value上，所以ref生成的对象，要通过value使用。重写get/set获得的监听，同时对对象的处理，也依赖了reactive的实现。 由此，ref并不只是具有对基本数据类型的响应式处理能力，他也是可以处理对象的。
 所以我认为ref和reactive的区分并不应该只是简单/复杂对象的区分，而是应该用编程思想区分的。我们应该避免，把reactive 当作data在顶部将所有变量声明的想法，而是应该结合具体的逻辑功能，比如一个控制灰度的Flag那他就因该是一个ref，而分页当中的页码，pageSize，total等就应该是一个reactive声明的对象。也就是说一个setup当中可以有多出响应变量的声明，而且他们应当是与逻辑紧密结合的。

接下来我先用一个分页的功能，用选项式和组合式api给大家对比一下：

```vue
// options api
<template>
    <div>
        <ul class="article-list">
            <li v-for="item in articleList" :key="item.id">
                <div>
                    <div class="title">{{ item.title }}</div>
                    <div class="content">{{ item.content }}</div>
                </div>
            </li>
        </ul>
        <el-pagination
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
            :current-page="currentPage"
            :page-sizes="pageSizes"
            :page-size="pageSize"
            layout="total, sizes, prev, pager, next, jumper"
            :total="total"
        >
        </el-pagination>
    </div>
</template>
<script>
import { getArticleList } from '@/mock/index';
export default {
    data() {
        return {
            articleList: [],
            currentPage: 1,
            pageSizes: [5, 10, 20],
            pageSize: 5,
            total: 0,
        };
    },
    created() {
        this.getList();
    },
    methods: {
        getList() {
            const param = {
                currentPage: this.currentPage,
                pageSizes: this.pageSizes,
                pageSize: this.pageSize,
            };
            getArticleList(param).then((res) => {
                this.articleList = res.data;
                this.total = res.total;
            });
        },
        handleSizeChange(val) {
            this.pageSize = val;
            this.getList();
        },
        handleCurrentChange(val) {
            this.currentPage = val;
            this.getList();
        },
    },
};
</script>
```

上面就是我们熟悉到不能在熟悉的分页流程，在data中声明数据，在method中提供修分页的方法。当我们用composition-api实现的时候他面成了下面的样子：

```vue
<script>
import { defineComponent, reactive, ref, toRefs } from "@vue/composition-api";
import { getArticleList } from "@/mock/index";
export default defineComponent({
  setup() {
    const page = reactive({
      currentPage: 1,
      pageSizes: [5, 10, 20],
      pageSize: 5,
      total: 0,
    });
    function handleSizeChange(val) {
      page.pageSize = val;
      getList();
    }
    function handleCurrentChange(val) {
      page.currentPage = val;
      getList();
    }
    const articleList = ref([]);
    function getList() {
      getArticleList(page).then((res) => {
        articleList.value = res.data;
        page.total = res.total;
      });
    }
    getList();
    return {
      ...toRefs(page),
      articleList,
      getList,
      handleSizeChange,
      handleCurrentChange,
    };
  },
});
</script>

```

这是以composition-api的方式实现的分页，你会发现原本的data，method，还有声明周期等选项都不见了，所有的逻辑都放到了setup当中。通过这一个简单的例子，我们可以发现原本分散在各个选项中的逻辑，在这里得到了聚合。这种变化在复杂场景下更为明显。在复杂组件中，这种情况更加明显。 而且当逻辑完全聚集在一起，这时候，将他们抽离出来，而且抽离逻辑的可以在别处复用，至此hook就形成了。

hook形态的分页组件：

```vue
// hooks/useArticleList.js
import { ref } from "@vue/composition-api";
import { getArticleList } from "@/mock/index"; // mock ajax请求
function useArticleList() {
  const articleList = ref([]);
  function getList(page) {
    getArticleList(page).then((res) => {
      articleList.value = res.data;
      page.total = res.total;
    });
  }
  return {
    articleList,
    getList,
  };
}
export default useArticleList;

// hooks/usePage.js
import { reactive } from "@vue/composition-api";
function usePage(changeFn) {
  const page = reactive({
    currentPage: 1,
    pageSizes: [5, 10, 20],
    pageSize: 5,
    total: 0,
  });
  function handleSizeChange(val) {
    page.pageSize = val;
    changeFn(page);
  }
  function handleCurrentChange(val) {
    page.currentPage = val;
    changeFn(page);
  }
  return {
    page,
    handleSizeChange,
    handleCurrentChange,
  };
}
export default usePage;
// views/List.vue
import { defineComponent, toRefs } from "@vue/composition-api";
import usePage from "@/hooks/usePage";
import useArticleList from "@/hooks/useArticleList";
export default defineComponent({
  setup() {
    const { articleList, getList } = useArticleList();
    const { page, handleSizeChange, handleCurrentChange } = usePage(getList);
    getList(page);
    return {
      ...toRefs(page),
      articleList,
      getList,
      handleSizeChange,
      handleCurrentChange,
    };
  },
});
```

### 在项目中的使用

在vue2中也能使用composition api，只需要引入[@vue/composition-api](https://github.com/vuejs/composition-api)这个包，而且经过测试，对于IE11的兼容性没有问题，那就可以放心的在项目中使用了，所以在金融综合安防V1.7.0的二期中，我们引入了composition api。

```javascript
// main.js
import VueCompositionAPI from '@vue/composition-api'
Vue.use(VueCompositionAPI)
```

首先想到的是典型列表页面的增删改查可以封装成hooks来达到复用效果，之前每次写这种curd业务，一些逻辑重复写，比如删除、分页跳转等，虽然逻辑简单，但还是需要耗一些时间的，这次干脆好好封装一下，以后再也不用写这种没技术含量的代码了。

下面举一些项目中封装的curd的逻辑：

1）列表分页hook

参考上面一节

2）添加hook

在添加/编辑页面，保存前进行表单校验，调用保存接口，取消返回上一级页面，这些都是通用逻辑，涉及数据：

```javascript
const loading = ref(false) // 保存的loading标识
```

涉及的功能函数：

```javascript
// 保存函数，先进行表单校验，通过hook传入保存的接口、传参
const handleSave = () => {
    form.value.validate(async valid => {
        if (valid) {
            loading.value = true
            try {
                await api.save(params && params.formModel)
                root.$message.success('保存成功')
            } finally {
                loading.value = false
            }
        }
    })
}
// 取消
const handleCancel = () => {
    root.$router.go(-1)
}
```

在使用的时候只需要调用hook函数，传入列表保存接口、保存传参，在模板中使用同名功能函数。

3）列表hook

列表中一般存在操作项（添加、编辑、详情、删除），上面筛选项支持查询和重置，可以集成前面的列表分页hook，实现完整的列表通用功能，涉及的功能函数：

```javascript
// 重置筛选项
const handleReset = () => {
    search.value.getForm().resetFields()
    handleSearch()
}
// 删除，支持单个删除和批量删除，支持不同的唯一标识字段，是否需要二次提示
const handleDeleteData = async (row, id = 'id', hintFlag = true) => {
    let data = []
    if (row) {
        data = [row]
    } else {
        data = checkedList.value
    }
    const deleteAndUpdateData = async () => {
        const ids = data.map(item => item[id])
        await api.delete(ids)
        root.$message.success('删除成功！')
        handleSearch()
    }
    if (hintFlag) {
        root.$confirm('是否确定删除？', {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            onConfirm: () => {
                deleteAndUpdateData()
            },
            onCancel: () => {
                console.log('取消删除')
            }
        })
    } else {
        deleteAndUpdateData()
    }
}
// 跳转到添加页面，支持不同的添加页路由
const handleAdd = () => {
    root.$router.push({
        path: params.addPath
    })
}
// 跳转到编辑页面，支持不同的唯一标识，路由与添加一致
const handleEdit = (row, id = 'id') => {
    root.$router.push({
      path: params.addPath,
      query: {
        [id]: row[id]
      }
    })
}
// 跳转到详情页面，支持不同的路由和唯一标识
const handleDetail = (row, id = 'id') => {
    root.$router.push({
      path: params.detailPath,
      query: {
        [id]: row[id]
      }
    })
}
// 导出
const handleExport = () => {
    window.location.href = api.exportUrl + `?${qs.stringify(params.searchParam)}`
}
```

在使用的时候只需要调用hook函数，传入删除接口、唯一字段标识、是否需要二次确认，在模板中使用同名功能函数，目前接口调用只按照大部分接口传参习惯，如果有对应后端接口传参不一致，可以去沟通让其保持一致，很多这种通用的功能需要去推动接口规范，等整套hooks稳定之后会去推动后端遵守这套规范。

4）详情hook

编辑和详情页都存在从路由参数中获取唯一标识，调接口获取详情数据，可以封装成详情hook：

```javascript
const identifier = root.$route.query[id] // 唯一标识
const getDetail = async () => {
    const { data } = await api.detail(identifier)
    return data
}
```

在使用的时候只需要调用hook函数，传入唯一字段标识、详情接口。

vue的官方也基于composition api提取了函数集合[VueUse](https://vueuse.org/)。

当然composition api 不仅仅是用于复用公共逻辑，还能用于更好的代码组织抽取组合式函数：

抽取组合式函数不仅是为了复用，也是为了代码组织。随着组件复杂度的增高，你可能会最终发现组件多得难以查询和理解。组合式 API 会给予你足够的灵活性，让你可以基于逻辑问题将组件代码拆分成更小的函数：

```jsx
<script setup>
	import { useFeatureA } from './featureA.js'
	import { useFeatureB } from './featureB.js'
	import { useFeatureC } from './featureC.js'
	const { foo, bar } = useFeatureA()
	const { baz } = useFeatureB(foo)
	const { qux } = useFeatureC(baz)
</script>
```

在某种程度上，你可以将这些提取出的组合式函数看作是可以相互通信的组件范围内的服务。

### 最佳实践

#### 命名

组合式函数约定用驼峰命名法命名，并以“use”作为开头。

#### 输入参数

尽管其响应性不依赖 ref，组合式函数仍可接收 ref 参数。如果编写的组合式函数会被其他开发者使用，你最好在处理输入参数时兼容 ref 而不只是原始的值。[unref()](<https://staging-cn.vuejs.org/api/reactivity-utilities.html#unref>) 工具函数会对此非常有帮助：

```jsx
import { unref } from 'vue'
function useFeature(maybeRef) {  
	// 若 maybeRef 确实是一个 ref，它的 .value 会被返回 
	// 否则，maybeRef 会被原样返回
	const value = unref(maybeRef)
}
```

如果你的组合式函数在接收 ref 为参数时会产生响应式 effect，请确保使用 `watch()` 显式地监听此 ref，或者在 `watchEffect()` 中调用 `unref()` 来进行正确的追踪。

#### 返回值

你可能已经注意到了，我们一直在组合式函数中使用 `ref()` 而不是 `reactive()`。我们推荐的约定是组合式函数始终返回一个 ref 对象，这样该函数在组件中解构之后仍可以保持响应性：

```jsx
// x 和 y 是两个 ref
const { x, y } = useMouse()
```

从组合式函数返回一个响应式对象会导致在对象解构过程中丢失与组合式函数内状态的响应性连接。与之相反，ref 则可以维持这一响应性连接。

如果你更希望以对象 property 的形式从组合式函数中返回状态，你可以将要返回的对象用 `reactive()` 包装，这样其中的 ref 会被自动解包，例如：

```jsx
const mouse = reactive(useMouse())
// mouse.x 链接到了原来的 x ref
console.log(mouse.x)
Mouse position is at: {{ mouse.x }}, {{ mouse.y }}
```

#### hook封装功能原则

hook封装的功能尽量单一，在组件中使用通过组合的方式来使用，如果hook里面的功能逻辑复杂，那就失去了拆分成hook的意义了，通过组合的方式使用能更清晰展示使用过程，更好查看代码和定位问题了，通过解构直接暴露给template的变量和方法只能通过搜索的方式去查看了。

### 副作用

在组合式函数中的确可以执行副作用 (例如：添加 DOM 事件监听器或者请求数据)，但请注意以下规则：

- 如果你在一个应用中使用了**[服务器端渲染](https://staging-cn.vuejs.org/guide/scaling-up/ssr.html)** (SSR)，请确保在后置加载的声明钩子上执行 DOM 相关的副作用，例如：`onMounted()`。这些钩子仅会在浏览器中使用，因此可以确保能访问到 DOM。
- 确保在 `onUnmounted()` 时清理副作用。举个例子，如果一个组合式函数设置了一个事件监听器，它就应该在 `onUnmounted()` 中被移除 (就像我们在 `useMouse()` 示例中看到的一样)。当然也可以使用一个组合式函数来自动帮你做这些事。

### 限制

#### hook中的异步问题

因为hook本质上就是函数，所以灵活度非常高，尤其是在涉及异步的逻辑中，考虑不全面就很有可能造成很多问题。 hook是可以覆盖异步情况的，但是必须在setup当中执行时返回有效对象不能被阻塞。我们总结了两种异步的风格，通过一个简单的hook为例：

- 外部没有其他依赖，只是交付渲染的响应变量

对于这种情况，可以通过声明、对外暴露响应变量，在hook中异步修改的方式

```vue
// hooks/useWarehouse.js
import { reactive,toRefs } from '@vue/composition-api';
import { queryWarehouse } from '@/mock/index';  // 查询仓库的请求
import getParam from '@/utils/getParam'; // 获得一些参数的方法
function useWarehouse(admin) {
    const warehouse = reactive({ warehouseList: [] });
    const param = { id: admin.id, ...getParam() };
    const queryList = async () => {
        const { list } = await queryWarehouse(param);
        list.forEach(goods=>{
        // 一些逻辑...
          return goods
        })
        warehouse.warehouseList = list;
    };
    return { ...toRefs(warehouse), queryList };
}
export default useWarehouse;

// components/Warehouse.vue
<template>
    <div>
        <button @click="queryList">queryList</button>
        <ul>
            <li v-for="goods in warehouseList" :key="goods.id">
                {{goods}}
            </li>
        </ul>
    </div>
</template>
<script>
import { defineComponent } from '@vue/composition-api';
import useWarehouse from '@/hooks/useWarehouse';
export default defineComponent({
    setup() {
        // 仓库保管员
        const admin = {
            id: '1234',
            name: '张三',
            age: 28,
            sex: 'men',
        };
        const { warehouseList, queryList } = useWarehouse(admin);
        return { warehouseList, queryList };
    },
});
</script>

```

- 外部具有依赖，需要在使用侧进行加工的

可以通过对外暴露Promise的方式，使外部获得同步操作的能力
在原有例子上拓展，增加一个需要处理的更新时间属性

```vue
// hooks/useWarehouse.js
function useWarehouse(admin) {
    const warehouse = reactive({ warehouseList: [] });
    const param = { id: admin.id, ...getParam() };
    const queryList = async () => {
        const { list, updateTime } = await queryWarehouse(param);
            list.forEach(goods=>{
        // 一些逻辑...
          return goods
        })
        warehouse.warehouseList = list;
        return updateTime;
    };
    return { ...toRefs(warehouse), queryList };
}
export default useWarehouse;
// components/Warehouse.vue
<template>
    <div>
       ...
        <span>nextUpdateTime:{{nextUpdateTime}}</span>
    </div>
</template>
<script>
...
import dayjs from 'dayjs';
export default defineComponent({
    setup() {
                ...
       // 仓库保管员
        const admin = {
            id: '1234',
            name: '张三',
            age: 28,
            sex: 'men',
        };
        const { warehouseList, queryList } = useWarehouse(admin);
        const nextUpdateTime = ref('');
        const interval = 7; // 假设更新仓库的时间间隔是7天
        const queryHandler = async () => {
            const updateTime = await queryList();
            nextUpdateTime.value = dayjs(updateTime).add(interval, 'day');
        };
        return { warehouseList, nextUpdateTime, queryHandler };
    },
});
</script>

```

#### this的问题

因为setup是beforecreate阶段，不能获取到this，虽然通过setup的第二个参数context可以获得一部分的能力，但如果我们想要操作诸如路由，vuex这样的能力就收到了限制，最新的router@4、vuex@4都提供了组合式的api。由于vue2的底层限制我们没有办法使用这些hook，虽然通过getCurrentInstance可以获得组件实例，上面挂载的对象，但由于composition-api中的响应式虽然底层原理与vue相同都是通过object.defineproperty改写属性实现的，但是具体实现方式存在差异，所以载setup当中与vue原生的响应式并不互通。这也导致即使我们拿到了相应的实例，也没有办法监听它们的响应式。如果有这方面的需求，只能在选项配置中使用。

组合式函数在 `<script setup>` 或 `setup()` 钩子中，应始终被**同步地**调用。在某些场景下，你也可以在像 `onMounted()` 这样的生命周期钩子中使用他们。

这些是 Vue 得以确定当前活跃的组件实例的条件。有能力对活跃的组件实例进行访问是必要的，以便：

1. 可以在组合式函数中注册生命周期钩子
2. 计算属性和监听器可以连接到当前组件实例，以便在组件卸载时处理掉。

`<script setup>` 是唯一在调用 `await` 之后仍可调用组合式函数的地方。编译器会在异步操作之后自动为你恢复当前活跃的组件实例。

#### 在选项式 API 中使用组合式函数

如果你正在使用选项式 API，组合式函数必须在 `setup()`中调用。且其返回的绑定必须在 `setup()`中返回，以便暴露给 `this`及其模板：

```jsx
import { useMouse } from './mouse.js'
import { useFetch } from './fetch.js'

export default {
  setup() {
    const { x, y } = useMouse()
    const { data, error } = useFetch('...')
    return { x, y, data, error }
  },
  mounted() {
    // setup() 暴露的 property 可以在通过 `this` 访问到
    console.log(this.x)
  }
  // ...其他选项
}
```

只能option api访问composition api抛出的值，反过来就不行，所以不建议composition api和options api混用。

#### 不能共享一个实例

每一个调用 useMouse() 的组件实例会创建其独有的 x、y 状态拷贝，因此他们不会互相影响。如果你想要在组件之间共享状态，得使用状态管理（pinia）

#### template用到的变量或方法

如果使用...toRef(useData())这种写法直接解构暴露到template的变量和方法，查看无法直接点击跳转，这个mixins也有一样的问题，都需要通过搜索来查看，这边建议hook在setup中进行组合使用，不要直接在return中解构使用，就算没有被其他hook或逻辑使用到，也建议先解构一次，return再返回。

### 总结

通过vue3组合式、与hook的能力。我们的代码风格有了很大的转变，逻辑更加聚合、纯粹。复用性能力得到了提升。项目整体的维护性有了显著的提高。这也是我们即便在vue2的项目中，也要使用composition-api引入vue3新特性的原因。composition api对于开发的业务逻辑拆分能力有比较高要求，如果拆分不好，很容易编写出面条型代码，也是反向推动前端人员对于业务需要更新熟悉。

### 参考链接

* [vue3官方文档](https://staging-cn.vuejs.org/)

