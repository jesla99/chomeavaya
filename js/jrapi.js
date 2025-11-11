/** mini cliente para jrApi
 * 
 * Creado por: Jesus Laynes
 * Fecha: 6 de Agosto de 2024
 * 
 */

class Jrapi{
    server=''
    version=''
    namespace=''
    token=''
    isrest=true
    schema='dev'

    constructor (ops={}){
        console.log(ops)
        for(let op in ops){
            this[op]=ops[op]
        }
    }

    async Get(endpoint){
        return await this.rfetch("GET", endpoint)
    }

    async Post(endpoint, body){
        return await  this.rfetch("GET", endpoint, body)
    }

    async Put(endpoint, body){
        return await this.rfetch("PUT", endpoint, body)

    }

    async Delete(endpoint){
        return await this.rfetch("DELETE", endpoint)
    
    }

    async rfetch(verb, endpoint, body={}, retorno){
        return new Promise(retorno=>{
            const ops={
                method:verb,
                headers: {
                    'Content-Type': 'application/json',
                    'namespace':this.namespace,
                    '_schema': this.schema,
                    'token': this.token,
                    'isrest': true
                }
            }

            if (verb == "POST" || verb == "PUT")
                ops.body= JSON.stringify(body) 
    
            fetch(`${this.server}/${this.version}${endpoint}`, ops)
                .then(resp=>resp.json()
                    .then(data=>{
                        retorno(data)
                    })
                )
            

        }) 

        
    }

}