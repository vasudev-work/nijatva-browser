package `in`.nijatva.browser

data class Container(val id: String, val name: String, val color: String, val ua: String = "")
data class TabState(val url: String, val title: String)
